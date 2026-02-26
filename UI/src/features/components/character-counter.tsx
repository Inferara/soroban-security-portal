import React from 'react';
import { Typography } from '@mui/material';

interface CharacterCounterProps {
    current: number;
    max: number;
}

export const CharacterCounter: React.FC<CharacterCounterProps> = ({ current, max }) => {
    const nearLimit = current >= max * 0.85;
    const overLimit = current > max;

    return (
        <Typography
            variant="caption"
            display="block"
            textAlign="right"
            sx={{
                mt: 0.5,
                userSelect: 'none',
                color: overLimit ? 'error.main' : nearLimit ? 'warning.main' : 'text.disabled',
                fontWeight: overLimit ? 600 : 400,
                transition: 'color 0.2s',
            }}
        >
            {current}/{max}
        </Typography>
    );
};