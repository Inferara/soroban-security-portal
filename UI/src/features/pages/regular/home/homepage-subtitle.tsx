import { Box, Typography } from "@mui/material";
import { FC } from "react";

export interface HomepageSubtitleProps {
    title: string;
    isCompact?: boolean;
    isLeft?: boolean;
}

export const HomepageSubtitle: FC<HomepageSubtitleProps> = ({
    title,
    isCompact = false,
    isLeft = true
}) => {
    return (
        <Box
            sx={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                flexDirection: isCompact ? 'column' : { xs: 'column', sm: 'column', md: isLeft ? 'row' : 'row-reverse' },
                gap: isCompact ? 2 : 3,
                pt: { xs: 1, md: 2 },
                pb: { xs: 1, md: 2 },
            }}
        >
            <Box sx={{
                width: isCompact ? '100%' : { xs: '100%', sm: '100%', md: '50%' },
                display: 'flex', 
                justifyContent: isCompact ? 'center' : { xs: 'center', sm: 'center', md: isLeft ? 'flex-end' : 'flex-start' }
            }}>
                <Typography variant={isCompact ? 'h4' : 'h2'} sx={{
                    color: 'primary.contrastText',
                    textTransform: "uppercase",
                    whiteSpace: 'nowrap',
                    textAlign: isCompact ? 'center' : { xs: 'center', sm: 'center', md: isLeft ? 'right' : 'left' },
                }}>{title}</Typography>
            </Box>
            <Box sx={{ width: isCompact ? '0%' : { xs: '0%', sm: '0%', md: '50%' } }}></Box>
        </Box>
    )
}
