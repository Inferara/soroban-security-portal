import React, { CSSProperties } from 'react';
import { useAutocomplete, AutocompleteGetTagProps } from '@mui/base/useAutocomplete';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import './chips-control.css';
import { IconButton, Tooltip } from '@mui/material';

interface ChipsProps extends ReturnType<AutocompleteGetTagProps> {
  label: string;
  showCross?: boolean;
  disabled?: boolean;
  color?: string;
}

function getContrastYIQ(hexcolor: string) {
  // Remove # if present
  hexcolor = hexcolor.replace('#', '');
  if (hexcolor.length === 3) {
    hexcolor = hexcolor.split('').map(x => x + x).join('');
  }
  const r = parseInt(hexcolor.substr(0,2),16);
  const g = parseInt(hexcolor.substr(2,2),16);
  const b = parseInt(hexcolor.substr(4,2),16);
  const yiq = ((r*299)+(g*587)+(b*114))/1000;
  return (yiq >= 128) ? '#000' : '#fff';
}

function Chip(props: ChipsProps) {
  const { label, showCross, disabled, color, onDelete, ...other } = props;
  const textColor = color ? getContrastYIQ(color) : undefined;
  return (
    <div style={{backgroundColor: color, color: textColor, margin: '2px'}} className={ !disabled ? 'tag-item' : 'tag-item disabled' } {...other}>
      <span>{label}</span>
      {showCross === true ? <CloseIcon onClick={onDelete} /> : ''}
    </div>
  );
}

interface ChipsControlProps {
  border?: string;
  width?: string;
  style?: CSSProperties;
  disabled?: boolean;
  chips?: unknown[];
  chipsSelected?: unknown[];
  controlText?: string;
  chipText: (e: unknown) => string;
  chipColor?: (e: unknown) => string;
  onChange?: (e: unknown[]) => void;
}

export const ChipsControl: React.FC<ChipsControlProps> = (props: ChipsControlProps) => {

  const {
    getRootProps,
    getInputProps,
    getTagProps,
    getListboxProps,
    getOptionProps,
    groupedOptions,
    value,
    focused,
    setAnchorEl,
  } = useAutocomplete({
    id: 'tags-control',
    defaultValue: [],
    multiple: true,
    options: props.chips || [],
    value: props.chipsSelected,
    disabled: props.disabled,
    getOptionLabel: props.chipText,
    onChange: (_, value) => {
      if (props.onChange) {
        props.onChange(value);
      }
    }
  });
  
  const handleFilterIconClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const inputRef = (e?.target as HTMLElement)?.closest('.tags-input-wrapper')?.querySelector("#tags-control") as unknown as HTMLInputElement;
    if (inputRef) {
       // Programmatically focus the input field
      inputRef.focus();
      const event = new KeyboardEvent('keydown', {
        key: 'ArrowDown',
        code: 'ArrowDown',
        keyCode: 40,
        charCode: 40,
        bubbles: true,
        cancelable: true,
      });
      // Simulate a key press event
      inputRef.dispatchEvent(event);
    }
  };

  return (
    <div className="tags-root-container" style={props.style}>
      <div style={props.style} {...getRootProps()}>
        <div ref={setAnchorEl} 
          className={focused 
            ? (!props.disabled 
              ? 'focused tags-input-wrapper' 
              : 'focused tags-input-wrapper disabled') 
            : (!props.disabled 
              ? 'tags-input-wrapper' 
              : 'tags-input-wrapper disabled')} 
          style={{ 
            width: props.width, 
            maxWidth: props.width, 
            padding: "4px 8px", 
            display: "flex", 
            justifyContent: "flex-start",
            border: props.disabled ? "none" : (props.border ?? "1px solid #d9d9d9") }}
          >
            {props.controlText ? <span style={{ marginRight: '8px', fontSize: '12px', marginTop: '-4px', marginLeft: '-4px' }}>{props.controlText}</span> : null}
          <input type={ !props.disabled ? 'text' : 'hidden' } {...getInputProps()} style={{ minWidth: 60 }} />         
          {
            !props.disabled && 
              <Tooltip title="Choose Tags for Data Sources">
                <IconButton sx={{padding: '4px'}} onClick={e => handleFilterIconClick(e)}>
                  <FilterAltIcon />
                </IconButton>
              </Tooltip>
          }
          {value.map((option: unknown, index: number) => {
            const tagProps = getTagProps({ index });
            const { key, ...restTagProps } = tagProps;
            return (
              <span key={index}>
                <Chip 
                  color={props.chipColor ? props.chipColor(option) : "#ffffff"}
                  label={props.chipText(option)}  
                  showCross={!props.disabled} 
                  disabled={props.disabled} 
                  key={key}
                  {...restTagProps}
                />
              </span>
            );
          })}                
        </div>
      </div>
      {groupedOptions.length > 0 ? (
        <ul className='tags-available' {...getListboxProps()} style={{ width: props.width, zIndex: '2' }}>
          {(groupedOptions as typeof props.chips || []).map((option, index) => {
            const { key: _key, ...optionProps } = getOptionProps({ option, index });
            return (
              <li key={index} {...optionProps}>
                <span>{props.chipText(option)}</span>
                <CheckIcon fontSize="small" />
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}