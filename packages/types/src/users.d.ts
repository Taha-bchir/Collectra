import type { Tables } from './types.js';
export type BackendUserProfile = {
    id: Tables<'User'>['id'];
    email: Tables<'User'>['email'];
    profile: {
        fullName?: Tables<'User'>['fullName'];
    };
};
export type UpdateMePayload = {
    fullName?: string;
};
//# sourceMappingURL=users.d.ts.map