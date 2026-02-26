import React, { useState } from 'react';
import {
    Autocomplete,
    Chip,
    TextField,
    Stack,
    Typography,
    Box,
    createFilterOptions,
    type SxProps,
    type Theme,
} from '@mui/material';
import {
    PREDEFINED_EXPERTISE_TAGS,
    MAX_TAG_LENGTH,
    MAX_TAGS,
} from '../../api/soroban-security-portal/models/user';

/** Shared chip style used here and in profile.tsx — import from this file to avoid duplication. */
export const expertiseChipSx: SxProps<Theme> = {
    backgroundColor: 'primary.main',
    color: 'primary.contrastText',
    fontWeight: 500,
    fontSize: '0.8125rem',
    '&:hover': { backgroundColor: 'primary.dark' },
};

interface ExpertiseTagsInputProps {
    value: string[];
    onChange: (tags: string[]) => void;
    error?: string;
}

const filter = createFilterOptions<string>();

export const ExpertiseTagsInput: React.FC<ExpertiseTagsInputProps> = ({
    value,
    onChange,
    error,
}) => {
    const [inputValue, setInputValue] = useState('');

    const handleChange = (_: React.SyntheticEvent, newValue: (string | string[])[]) => {
        const flat = (newValue as string[])
            .flat()
            .map((v) => {
                const m = v.match(/^Add "(.+)"$/);
                return m ? m[1] : v;
            })
            .map((v) => v.trim())
            .filter((v) => v.length > 0 && v.length <= MAX_TAG_LENGTH);

        // Deduplicate case-insensitively, preserving first occurrence
        const seen = new Set<string>();
        const unique = flat.filter((t) => {
            const key = t.toLowerCase();
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        onChange(unique.slice(0, MAX_TAGS));
        setInputValue('');
    };

    const atLimit = value.length >= MAX_TAGS;

    return (
        <Box>
            <Autocomplete
                multiple
                freeSolo
                options={PREDEFINED_EXPERTISE_TAGS.filter(
                    (tag) => !value.some((v) => v.toLowerCase() === tag.toLowerCase()),
                )}
                value={value}
                inputValue={inputValue}
                onInputChange={(_, v) => setInputValue(v)}
                onChange={handleChange}
                filterOptions={(options, params) => {
                    const filtered = filter(options, params);
                    const { inputValue: input } = params;
                    const isExisting = options.some(
                        (o) => o.toLowerCase() === input.toLowerCase(),
                    );
                    if (input.trim() !== '' && !isExisting && input.length <= MAX_TAG_LENGTH) {
                        filtered.push(`Add "${input.trim()}"`);
                    }
                    return filtered;
                }}
                renderTags={(tagValue, getTagProps) =>
                    tagValue.map((tag, index) => (
                        <Chip
                            {...getTagProps({ index })}
                            key={tag}
                            label={tag}
                            size="small"
                            sx={{
                                ...expertiseChipSx,
                                '& .MuiChip-deleteIcon': {
                                    color: 'primary.contrastText',
                                    opacity: 0.7,
                                    '&:hover': { opacity: 1 },
                                },
                            }}
                        />
                    ))
                }
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Expertise Tags"
                        placeholder={atLimit ? '' : 'Search or type to add a tag…'}
                        error={Boolean(error)}
                        helperText={error}
                    />
                )}
            />
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.5, px: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                    Pick from the list or type a custom tag (max {MAX_TAG_LENGTH} chars each)
                </Typography>
                <Typography
                    variant="caption"
                    color={atLimit ? 'error.main' : 'text.secondary'}
                    fontWeight={atLimit ? 600 : 400}
                >
                    {value.length}/{MAX_TAGS}
                </Typography>
            </Stack>
        </Box>
    );
};