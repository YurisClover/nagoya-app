export function getLandingPath(role?: string): string{
    return role === "admin" ? "/admin" : "/dashboard";
}