<template>
	<div class="kyc-review">
		<!-- ── Signed out ─────────────────────────────────────── -->
		<template v-if="!session">
			<v-notice type="info">
				Sign in with your Supabase admin account to view identity documents.
				This is separate from your Directus login so that each reviewer's
				access is recorded individually.
			</v-notice>
			<div class="signin">
				<v-input v-model="email" placeholder="Admin email" autocomplete="username" />
				<v-input
					v-model="password"
					type="password"
					placeholder="Password"
					autocomplete="current-password"
					@keyup.enter="signIn"
				/>
				<v-button :loading="authBusy" :disabled="!email || !password" @click="signIn">
					Sign in
				</v-button>
			</div>
			<v-notice v-if="authError" type="danger">{{ authError }}</v-notice>
		</template>

		<!-- ── Signed in ──────────────────────────────────────── -->
		<template v-else>
			<div class="who">
				<v-icon name="verified_user" small />
				<span>{{ session.user.email }}</span>
				<v-button x-small secondary @click="signOut">Sign out</v-button>
			</div>

			<v-notice v-if="!nicHash" type="warning">
				<strong>No NIC hash on file.</strong>
				This record cannot leave <code>pending</code> — the
				<code>talent_identity_complete_when_submitted_check</code> constraint
				requires nic_hash, nic_last_four and both document keys. The talent must
				re-enter their NIC number; it is never stored in raw form, so it cannot
				be repaired server-side.
			</v-notice>

			<v-notice v-if="nicLastFour" type="info">
				NIC ending <strong>{{ nicLastFour }}</strong> · status
				<strong>{{ kycStatus || 'unknown' }}</strong>
			</v-notice>

			<div class="docs">
				<div v-for="doc in docs" :key="doc.side" class="doc">
					<div class="doc-head">
						<strong>{{ doc.label }}</strong>
						<span v-if="doc.remaining > 0" class="ttl">expires in {{ doc.remaining }}s</span>
					</div>

					<v-notice v-if="!doc.objectKey" type="warning">Not uploaded.</v-notice>

					<template v-else>
						<v-button
							v-if="doc.remaining <= 0"
							:loading="doc.busy"
							small
							@click="load(doc.side)"
						>
							{{ doc.url ? 'Reload document' : 'Load document' }}
						</v-button>

						<v-notice v-if="doc.error" type="danger">{{ doc.error }}</v-notice>

						<template v-if="doc.remaining > 0 && doc.url">
							<iframe v-if="doc.isPdf" :src="doc.url" class="viewer" />
							<img v-else :src="doc.url" class="viewer" alt="" />
							<a :href="doc.url" target="_blank" rel="noopener noreferrer">Open in new tab</a>
						</template>
					</template>
				</div>
			</div>

			<p class="footnote">
				Every load writes a row to <code>sensitive_asset_access_log</code> before
				the URL is issued. Links expire after 120 seconds.
			</p>
		</template>
	</div>
</template>

<script setup lang="ts">
import { computed, inject, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config';

defineProps<{ value?: string | null }>();

// Sibling field values. Since Directus 10.12 the injected ref must be
// re-wrapped in a computed inside setup(), or it reads as an empty object.
const valuesRef = inject<any>('values', ref({}));
const values = computed<Record<string, any>>(() => valuesRef.value ?? {});

const nicHash = computed(() => values.value.nic_hash);
const nicLastFour = computed(() => values.value.nic_last_four);
const kycStatus = computed(() => values.value.kyc_status);

// ── Auth ────────────────────────────────────────────────────────────
const session = ref<Session | null>(null);
const email = ref('');
const password = ref('');
const authError = ref('');
const authBusy = ref(false);

async function signIn() {
	authBusy.value = true;
	authError.value = '';
	const { data, error } = await supabase.auth.signInWithPassword({
		email: email.value,
		password: password.value,
	});
	if (error) authError.value = error.message;
	else session.value = data.session;
	password.value = '';
	authBusy.value = false;
}

async function signOut() {
	await supabase.auth.signOut();
	session.value = null;
	clearAll();
}

// ── Documents ───────────────────────────────────────────────────────
type Side = 'front' | 'back';

const state = reactive<Record<Side, { url: string; expiresAt: number; isPdf: boolean; busy: boolean; error: string }>>({
	front: { url: '', expiresAt: 0, isPdf: false, busy: false, error: '' },
	back: { url: '', expiresAt: 0, isPdf: false, busy: false, error: '' },
});

const now = ref(Date.now());
let ticker: number | undefined;

const docs = computed(() =>
	(['front', 'back'] as Side[]).map((side) => {
		const s = state[side];
		const remaining = s.expiresAt ? Math.max(0, Math.ceil((s.expiresAt - now.value) / 1000)) : 0;
		return {
			side,
			label: side === 'front' ? 'NIC — front' : 'NIC — back',
			objectKey: values.value[`nic_${side}_public_id`],
			url: s.url,
			isPdf: s.isPdf,
			busy: s.busy,
			error: s.error,
			remaining,
		};
	})
);

async function load(side: Side) {
	const s = state[side];
	const objectKey = values.value[`nic_${side}_public_id`];
	if (!objectKey || !session.value) return;

	s.busy = true;
	s.error = '';

	try {
		// Raw fetch rather than functions.invoke(): invoke does not reliably
		// surface a 4xx JSON body as an error, which has bitten this codebase
		// before with submit-nic's 409.
		const res = await fetch(`${SUPABASE_URL}/functions/v1/r2-deliver`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				apikey: SUPABASE_ANON_KEY,
				Authorization: `Bearer ${session.value.access_token}`,
			},
			body: JSON.stringify({
				asset_type: side === 'front' ? 'kyc_front' : 'kyc_back',
				object_key: objectKey,
			}),
		});

		const body = await res.json().catch(() => ({}));

		if (!res.ok) {
			s.error =
				res.status === 403
					? 'Forbidden — this Supabase account does not have the admin role.'
					: res.status === 404
						? 'No record references this object key.'
						: body?.error || `Request failed (${res.status}).`;
			return;
		}

		s.url = body.url;
		s.isPdf = String(objectKey).toLowerCase().endsWith('.pdf');
		s.expiresAt = Date.now() + (body.expires_in ?? 120) * 1000;
	} catch (err: any) {
		s.error = err?.message || 'Network error.';
	} finally {
		s.busy = false;
	}
}

function clearAll() {
	(['front', 'back'] as Side[]).forEach((side) => {
		state[side].url = '';
		state[side].expiresAt = 0;
		state[side].error = '';
	});
}

onMounted(async () => {
	// Session only. Documents are never fetched on mount — an access is
	// logged per view, so scrolling past this field must not create one.
	const { data } = await supabase.auth.getSession();
	session.value = data.session;
	ticker = window.setInterval(() => {
		now.value = Date.now();
		(['front', 'back'] as Side[]).forEach((side) => {
			if (state[side].expiresAt && state[side].expiresAt <= now.value) {
				state[side].url = '';
				state[side].expiresAt = 0;
			}
		});
	}, 1000);
});

onBeforeUnmount(() => {
	if (ticker) clearInterval(ticker);
	clearAll();
});
</script>

<style scoped>
.signin { display: flex; gap: 8px; align-items: center; margin-top: 8px; flex-wrap: wrap; }
.who { display: flex; gap: 8px; align-items: center; margin-bottom: 12px; }
.docs { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 12px; }
.doc { flex: 1 1 320px; border: var(--theme--border-width) solid var(--theme--border-color-subdued); border-radius: var(--theme--border-radius); padding: 12px; }
.doc-head { display: flex; justify-content: space-between; margin-bottom: 8px; }
.ttl { color: var(--theme--warning); font-family: var(--theme--fonts--monospace--font-family); }
.viewer { width: 100%; height: 420px; margin-top: 8px; border: none; background: var(--theme--background-subdued); object-fit: contain; }
.footnote { margin-top: 12px; color: var(--theme--foreground-subdued); font-size: 13px; }
</style>