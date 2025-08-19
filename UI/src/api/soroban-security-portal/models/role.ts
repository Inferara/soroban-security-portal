import { AuthContextProps } from "react-oidc-context";

export enum Role {
    User = 'User',
    Admin = 'Admin',
    Contributor = 'Contributor',
    Moderator = 'Moderator',
}

export function isAuthorized(auth: AuthContextProps): boolean {
    if (!auth.user) return false;
    return [Role.Admin, Role.Moderator, Role.Contributor, Role.User].includes(auth.user?.profile.role as Role);
}