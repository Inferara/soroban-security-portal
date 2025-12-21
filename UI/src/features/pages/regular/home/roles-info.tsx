import { Box, Button, Paper, Stack, Typography } from "@mui/material";
import { FC } from "react";
import { useNavigate } from "react-router-dom";
import { HomepageSubtitle } from "./homepage-subtitle";
import { useAppAuth } from "../../../authentication/useAppAuth";

export interface RolesInfoProps {
    isCompact: boolean;
}

export const RolesInfo: FC<RolesInfoProps> = ({ isCompact = false }) => {
    const navigate = useNavigate();
    const { isAuthenticated, userName, isAdmin, isModerator, isContributor } = useAppAuth();

    const rolesData = [
        {
            name: "Guest",
            permissions: ["read"],
            description: "Readonly access is available for everyone"
        },
        {
            name: "User (logged in)",
            permissions: ["read", "download"],
            description: "Authorized users can download reports in the PDF format"
        },
        {
            name: "Contributor",
            permissions: ["read", "download", "create"],
            description: "Contributor are Pilots (see the handbook) or those who expressed interest in contibuting"
        },
        {
            name: "Moderator",
            permissions: ["read", "download", "create", "approve"],
            description: "Granted manually to active community members who are looking after the content integrity and quality"
        }
    ];

    const getUserPermissions = () => {
        if (isAdmin || isModerator) {
            return ["read", "download", "create", "approve"];
        } else if (isContributor) {
            return ["read", "download", "create"];
        } else {
            return ["read", "download"];
        }
    };

    const getUserRoleName = () => {
        if (isAdmin) return "Admin";
        if (isModerator) return "Moderator";
        if (isContributor) return "Contributor";
        return "User (logged in)";
    };

    return (
        <Paper
            elevation={3}
            sx={{
                p: isCompact ? 2 : 3,
                borderRadius: 2,
                backgroundColor: 'transparent',
                backdropFilter: 'blur(10px)',
                backgroundImage: 'none',
                boxShadow: 'none',
                overflow: 'hidden',
            }}>
            <HomepageSubtitle
                title={ isAuthenticated ? `Welcome, ${userName}!` : "How to contribute"}
                isCompact={isCompact}
            />
            <Box sx={{ width: '100%', px: { xs: 2, md: 5 }, py: { xs: 3, md: 5 }, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {isAuthenticated ? (
                    <>
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                            <Box sx={{ 
                                display: 'flex', 
                                flexDirection: 'column', 
                                alignItems: 'center', 
                                gap: 2,
                                p: 3,
                                borderRadius: 2,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                width: '100%',
                                maxWidth: '600px'
                            }}>
                                <Typography variant="h6" color="primary">
                                    Your Role: {getUserRoleName()}
                                </Typography>
                                <Typography variant="body1" sx={{ textAlign: 'center' }}>
                                    Your Permissions: {getUserPermissions().join(", ")}
                                </Typography>
                                <Typography variant="body1" sx={{ textAlign: 'center' }}>
                                    See roles and permissions breakdown below.
                                </Typography>
                                {
                                    (isAdmin || isModerator || isContributor) && (
                                        <Typography variant="body2" sx={{ textAlign: 'center', mt: 1 }}>
                                            Thank you for contributing to the Soroban Security Portal!
                                        </Typography>
                                    )
                                }
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 3, md: 5 } }}>
                            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'right' } }}>
                                <Typography variant="body1" sx={{ mb: 2 }}>
                                    Your contributions help improve the Portal and secure the Soroban ecosystem.
                                </Typography>
                                <Typography variant="body1">
                                    Continue engaging in{" "}
                                    <a href="https://discord.gg/vFHctE64fv" target="_blank" rel="noopener noreferrer">
                                        Stellar Developers Discord Server
                                    </a>
                                    {" "}to maintain your role.
                                </Typography>
                            </Box>
                            <Box sx={{
                                flex: 1,
                                display: 'flex',
                                justifyContent: { xs: 'center', sm: 'center', md: 'flex-start' }
                            }}>
                                <Button variant="outlined" size="large" onClick={() => navigate('/profile')}
                                    sx={{ px: 3, py: 1 }}>
                                    My Profile
                                </Button>
                            </Box>
                        </Box>
                    </>
                ) : (
                    // Non-authenticated User View
                    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: 'center', gap: { xs: 3, md: 5 } }}>
                        <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'right' } }}>
                            <Typography variant="body1" sx={{ mb: 2 }}>
                                Your contributions help improve the Portal and secure the Soroban ecosystem.
                            </Typography>
                            <Typography variant="body1">
                                Claim your role by authorizing with your Discord account in{" "}
                                <a href="https://discord.gg/UAnpE7pa" target="_blank" rel="noopener noreferrer">
                                    Stellar Developers Discord Server
                                </a>
                            </Typography>
                        </Box>
                        <Box sx={{
                            flex: 1,
                            display: 'flex',
                            justifyContent: { xs: 'center', sm: 'center', md: 'flex-start' }
                        }}>
                            <Button variant="contained" size="large" onClick={() => navigate('/login')}
                                sx={{ px: 3, py: 1 }}>
                                Log In
                            </Button>
                        </Box>
                    </Box>
                )}
                <Box sx={{
                    display: 'flex',
                    flexDirection: { xs: 'column', md: 'row-reverse' },
                    alignItems: 'center',
                    gap: { xs: 3, md: 5 }
                }}>
                    <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
                        <Typography variant="body1" sx={{ mb: 2 }}>
                            Roles are automatically granted according to the Stellar community guidelines.
                        </Typography>
                        <Typography variant="body1">
                            Defined in the{" "}
                            <a
                                target="_blank"
                                rel="noopener noreferrer"
                                href="https://stellarcommunityfund.gitbook.io/scf-handbook/governance/verified-members/how-to-become-verified"
                            >
                                Stellar Community Fund Handbook
                            </a>
                        </Typography>
                    </Box>
                    <Box sx={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: { xs: 'center', sm: 'center', md: 'flex-end' }
                    }}>
                        <Box
                            component="img"
                            src="/static/images/handbook-logo.avif"
                            sx={{ width: { xs: '60%', sm: '40%', md: '10%' } }}
                        />
                    </Box>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', pt: { xs: 5, md: 10 } }}>
                <HomepageSubtitle
                    title="Roles breakdown"
                    isLeft={false}
                    isCompact={isCompact}
                />
                {isCompact ? <Stack direction="column">
                    {rolesData.map(r => (
                        <Box key={r.name} sx={{ display: 'flex', justifyContent: 'space-between', p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
                            <Box>{r.name}</Box>
                            <Box sx={{ width: '50%' }}>{r.permissions.join(", ")}</Box>
                        </Box>
                    ))}
                </Stack> : (
                    <Box sx={{ overflow: 'auto', mt: 4 }}>
                        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
                            <Box component="thead">
                                <Box component="tr">
                                    <Box component="th" sx={{ padding: 2 }}>Role</Box>
                                    <Box component="th" sx={{ padding: 2 }}>Read</Box>
                                    <Box component="th" sx={{ padding: 2 }}>Download</Box>
                                    <Box component="th" sx={{ padding: 2 }}>Create / Edit</Box>
                                    <Box component="th" sx={{ padding: 2 }}>Approve</Box>
                                    <Box component="th" sx={{ padding: 2 }}>Description</Box>
                                </Box>
                            </Box>
                            <Box component="tbody">
                                {rolesData.map(r => (
                                    <Box component="tr" key={r.name}>
                                        <Box component="td" sx={{ p: 2 }}>{r.name}</Box>
                                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("read") ? "✅" : "❌"}</Box>
                                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("download") ? "✅" : "❌"}</Box>
                                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("create") ? "✅" : "❌"}</Box>
                                        <Box component="td" sx={{ p: 2 }}>{r.permissions.includes("approve") ? "✅" : "❌"}</Box>
                                        <Box component="td" sx={{ p: 2, textAlign: 'left', width: '40%' }}>{r.description}</Box>
                                    </Box>
                                ))}
                            </Box>
                        </Box>
                    </Box>)}
            </Box>
        </Paper>
    );
};