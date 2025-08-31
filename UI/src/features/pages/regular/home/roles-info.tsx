import { Box, Button, Stack, Typography } from "@mui/material";
import { FC } from "react";
import { useNavigate } from "react-router-dom";

export interface RolesInfoProps {
    isCompact: boolean;
}

export const RolesInfo: FC<RolesInfoProps> = ({ isCompact = false }) => {
    const navigate = useNavigate();

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

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', gap: 5, pt: { xs: 5, md: 10 } }}>
            <Box sx={{ display: 'flex', alignItems: 'right', flexDirection: { xs: 'column', md: 'row' }, gap: 5 }}>
                <Box sx={{ width: '50%', textAlign: 'right' }}>
                    <Typography variant="body1">Your contributions help improve the Portal and secure the Soroban ecosystem.</Typography>
                    <Typography variant="body1">Claim your role by authorizing with your Discord account in <a href="https://discord.gg/UAnpE7pa" target="_blank" rel="noopener noreferrer">Stellar Developers Discord Server</a></Typography>
                </Box>
                <Box sx={{ display: 'flex', width: '50%', alignItems: 'center', justifyContent: 'center' }}>
                    <Button variant='contained' size='large' onClick={() => navigate('/login')}>Log In</Button>
                </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'right', flexDirection: { xs: 'column', md: 'row-reverse' }, gap: 5 }}>
                <Box sx={{ width: '50%', textAlign: 'left' }}>
                    <Typography variant="body1">Roles are automatically granted according to the Stellar community guidelines</Typography>
                    <Typography variant="body1">Defined in the <a target="_blank" rel="noopener noreferrer" href="https://stellarcommunityfund.gitbook.io/scf-handbook/governance/verified-members/how-to-become-verified">Stellar Community Fund Handbook</a></Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Box component="img" src="/static/images/handbook-logo.avif" sx={{ width: { sm: '10%', md: '80%' } }} />
                </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', flexDirection: 'column', pt: { xs: 5, md: 10 } }}>
                <Typography variant='h4' sx={{ color: "primary.contrastText", textTransform: "uppercase" }}>Roles breakdown</Typography>

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
        </Box>
    );
};