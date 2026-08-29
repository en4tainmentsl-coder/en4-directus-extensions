import { defineInterface } from '@directus/extensions-sdk';
import InterfaceComponent from './interface.vue';

export default defineInterface({
	id: 'en4-kyc-review',
	name: 'KYC Document Review',
	icon: 'badge',
	description: 'Renders NIC documents through r2-deliver for admin review.',
	component: InterfaceComponent,
	options: null,
	// 'text' is the one that matters — every En4tainment column is Postgres
	// text, which Directus types as `text`, not `string`. Omitting it makes
	// this interface invisible in the picker with no error anywhere.
	types: ['string', 'text'],
	group: 'standard',
});