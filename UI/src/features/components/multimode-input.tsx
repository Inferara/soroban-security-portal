import React, { useState } from 'react';
import { OutlinedInput, OutlinedInputProps, InputAdornment, IconButton, Tooltip, FormControl, InputLabel } from '@mui/material';
import WrapTextIcon from '@mui/icons-material/WrapText';
import ShortTextIcon from '@mui/icons-material/ShortText';

interface MultiModeOutlinedInputProps extends OutlinedInputProps {
  initialMultiline?: boolean;
  toggleTooltipSingle?: string;
  toggleTooltipMulti?: string;
  onMultilineChange?: (multiline: boolean) => void;
}

const MultiModeOutlinedInput: React.FC<MultiModeOutlinedInputProps> = ({
  initialMultiline = false,
  endAdornment,
  label,
  value,
  toggleTooltipSingle = 'Switch to single line',
  toggleTooltipMulti = 'Switch to multiline',
  onMultilineChange,
  ...rest
}) => {
  const [multiline, setMultiline] = useState(initialMultiline);

  const handleToggleMultiline = () => {
    setMultiline((prev) => {
      const newState = !prev;
      onMultilineChange?.(newState);
      return newState;
    });
  };

  return (
    <FormControl variant="outlined" fullWidth>      
      <InputLabel htmlFor="outlined-adornment-password">{label}</InputLabel>
      <OutlinedInput
        label={label}
        value={value}
        multiline={multiline}
        minRows={multiline ? 4 : undefined}
        maxRows={multiline ? 4 : undefined}
        endAdornment={
          <InputAdornment position="end">
            <Tooltip title={multiline ? toggleTooltipSingle : toggleTooltipMulti}>
              <IconButton onClick={handleToggleMultiline} size="small">
                {multiline ? <ShortTextIcon /> : <WrapTextIcon />}
              </IconButton>
            </Tooltip>
            {endAdornment}
          </InputAdornment>
        }
      {...rest}
    />
    </FormControl>
  );
};

export default MultiModeOutlinedInput;
