import React from 'react';
import { CurrentPageState } from '../admin-main-window/current-page-slice'
import {
  TextField,
  Button,
  Grid, Paper,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  FormControl,
  InputLabel,
  OutlinedInput,
  InputAdornment,
  Box,
  Tooltip,
  Select,
  MenuItem,
  Stack} from '@mui/material'
import { useSettings } from './hooks';
import { styled } from '@mui/material/styles';
import { SettingsItem, DateType } from '../../../../api/soroban-security-portal/models/settings';
import { showWarning } from '../../../dialog-handler/dialog-handler'
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { MuiColorInput } from 'mui-color-input'
import { settingsControlStyle, Layout } from '../../../../theme';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const Settings: React.FC = () => {
  const currentPageState: CurrentPageState = {
    pageName: 'Settings',
    pageCode: 'settings',
    pageUrl:  window.location.pathname,
    routePath: 'settings',
  }

  const {
    saveSettings,
    settingsListData,
    setSettingsListData,
    reboot,
  } = useSettings({ currentPageState });

  const handleSave = async () => {
    await saveSettings(settingsListData);
    showWarning('Settings changes saved. It may take about 10 seconds to apply the changes. Page refresh is required. Some changes may require a reboot to take effect.');
  }

  const handleReboot = async () => {
    reboot();
    showWarning('Reboot started. Please wait for the system to restart');
  }

  const setSettingValue = (setting: SettingsItem, value: string) => {
    const settings = settingsListData.slice();
    settings.forEach((s) => {
      if (s.settingId === setting.settingId) {
        s.value = value;
      }
    });
    setSettingsListData(settings);
  }

  const setSettingState = (setting: SettingsItem, state: string) => {
    const settings = settingsListData.slice();
    settings.forEach((s) => {
      if (s.settingId === setting.settingId) {
        s.state = state;
      }
    });
    setSettingsListData(settings);
  }

  const renderSetting = (setting: SettingsItem) => {
    switch (setting.dateType) {
      case DateType.Boolean:
        return <ToggleButtonGroup
            sx={{ ...settingsControlStyle, height: '56px'}}
            color="primary"
            value={setting.value}
            exclusive
            aria-label="Platform"
          >
            <ToggleButton value="color" aria-label="color" disabled sx={{width: '100%'}}>
              <div>{setting.description}</div>
            </ToggleButton>
            <ToggleButton sx={{width: '100px'}} value="True" onChange={() => setSettingValue(setting, "True")}>Yes</ToggleButton>
            <ToggleButton sx={{width: '100px'}} value="False" onChange={() => setSettingValue(setting, "False")}>No</ToggleButton>

          </ToggleButtonGroup>
      case DateType.Password:
        return <FormControl sx={{ ...settingsControlStyle, height: '56px'}} variant="outlined">
            <InputLabel htmlFor="outlined-adornment-password">{setting.description}</InputLabel>
            <OutlinedInput
              id="outlined-adornment-password"
              value={setting.value}
              onChange={(e) => setSettingValue(setting, e.target.value)}
              type={setting.state === "text" ? 'text' : 'password'}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setSettingState(setting, setting.state === "text" ? "password" : "text")}
                    onMouseDown={() => setSettingState(setting, setting.state === "text" ? "password" : "text")}
                    edge="end"
                  >
                    {setting.state === "text" ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              }
              label={setting.description}
            />
          </FormControl>
      case DateType.Color:
        return <MuiColorInput
          sx={settingsControlStyle}
          format='hex'
          label={setting.description}
          value={setting.value}
          onChange={(e) => setSettingValue(setting, e)}
          />
      case DateType.Double:
        return <TextField
          sx={settingsControlStyle}
          label={setting.description}
          value={setting.value}
          onChange={(e) => setSettingValue(setting, e.target.value)}
          type="number"
          >
        </TextField>
      case DateType.Int:
        return <TextField
          sx={settingsControlStyle}
          label={setting.description}
          value={setting.value}
          type="number"
          onChange={(e) =>
            {
              // Only allow numbers
              if(/^\d+$/.test(e.target.value)){
                setSettingValue(setting, e.target.value);
              }
            }
          }
          >
        </TextField>
      case DateType.Url:
        return <FormControl sx={{ ...settingsControlStyle, height: '56px'}} variant="outlined">
          <InputLabel htmlFor="outlined-adornment-url">{setting.description}</InputLabel>
          <OutlinedInput
            id="outlined-adornment-url"
            value={setting.value}
            onChange={(e) => setSettingValue(setting, e.target.value)}
            type="text"
            endAdornment={
              <InputAdornment position="start">
                <Box
                  component="img"
                  sx={{
                    height: 40,
                    width: 40,
                  }}
                  src={setting.value}
                />
              </InputAdornment>
            }
            label={setting.description}
          />
        </FormControl>        
      case DateType.Dropdown:
        return <FormControl sx={{ ...settingsControlStyle, height: '56px'}} variant="outlined">
          <InputLabel>{setting.description}</InputLabel>
          <Select
            multiple={false}
            required={false}
            value={setting.value}
            label={setting.description}
            onChange={(e) => setSettingValue(setting, e.target.value)}
          >
            {setting.options!.map((option, index) => (
              <MenuItem value={option} key={index}>
                <div style={{width: '100%'}}>{option}</div>
              </MenuItem>              
            ))}
          </Select>
        </FormControl>
      case DateType.Link:
        return setting.value
          ? <Box component="a" sx={settingsControlStyle} href={setting.value} target="_blank" rel="noreferrer">{setting.description}</Box>
          : <></>
      default:
        return <TextField
          sx={settingsControlStyle}
          label={setting.description}
          value={setting.value}
          onChange={(e) => setSettingValue(setting, e.target.value)}
          type="text"
          >
        </TextField>
    }
  }

  const categories = Array.from(new Set(settingsListData.map((setting) => setting.category)))
  return (
    <Box sx={{ width: Layout.settingsPageWidth, display: 'flow-root'}}>
      <Grid container spacing={2}>
        {
          categories.map((category, index) => (
            <React.Fragment key={"c-"+index}>
              <Grid size={12} sx={{textAlign: 'center'}} >               
                <h3>{category}</h3>
              </Grid>
              {
                settingsListData.filter((setting) => setting.category === category).map((setting, index) => (
                  <Grid size={{ xs: 12, md: 6 }} key={"s-"+index}>
                    <Item>
                      <Tooltip title={setting.tooltip} placement="top">
                        {
                          renderSetting(setting)
                        }
                      </Tooltip>
                    </Item>
                  </Grid>
                ))
              }
            </React.Fragment>
          ))
        }
      </Grid>      
      <Stack sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 2,
          marginTop: 2,
          flexDirection: 'row'
        }}>
        <Button onClick={handleSave}>Save</Button>
        <Button onClick={handleReboot}>Reboot</Button>
        <Button onClick={() => history.back()}>Cancel</Button>
      </Stack>
    </Box>
  );
}