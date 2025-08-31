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
                flexDirection: isCompact ? 'column' : (isLeft ? 'row' : 'row-reverse'),
                gap: isCompact ? 2 : 3,
                pt: { xs: 1, md: 2 },
                pb: { xs: 1, md: 2 },
            }}
        >
            <Box sx={{
                width: '50%',
                display: 'flex', 
                justifyContent: isCompact ? 'center' : (isLeft ? 'flex-end' : 'flex-start')
            }}>
                <Typography variant={isCompact ? 'h4' : 'h2'} sx={{
                    color: 'primary.contrastText',
                    textTransform: "uppercase",
                    whiteSpace: 'nowrap',
                }}>{title}</Typography>
            </Box>
            <Box sx={{ width: '50%' }}></Box>
        </Box>
    )
}
