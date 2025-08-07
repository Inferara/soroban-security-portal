import { Autocomplete, Button, Grid, Paper, TextField } from '@mui/material';
import { styled } from '@mui/material/styles';
import { FC, useEffect, useState } from 'react';
import { ProtocolItem } from '../../../../../api/soroban-security-portal/models/protocol.ts';
import { showError } from '../../../../dialog-handler/dialog-handler.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useEditProtocol } from './hooks/index.ts';
import { useNavigate } from 'react-router-dom';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import { CompanyItem } from '../../../../../api/soroban-security-portal/models/company.ts';

const Item = styled(Paper)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  padding: '0px',
  textAlign: 'center',
  border: '0px',
  boxShadow: 'none',
}));

export const EditProtocol: FC = () => {
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState<CompanyItem | null>(null);

  const currentPageState: CurrentPageState = {
    pageName: 'Edit Protocol',
    pageCode: 'editProtocol',
    pageUrl: window.location.pathname,
    routePath: 'admin/protocols/edit',
  };
  const { editProtocol, protocol, companyListData } = useEditProtocol({ currentPageState });

  useEffect(() => {
    setName(protocol?.name ?? '');
    setUrl(protocol?.url ?? '');
    setCompany(companyListData.find(company => company.id === protocol?.companyId) ?? null);
  }, [protocol]);

  const handleEditProtocol = async () => {
    if (url === '' || name === '') {
      showError('All fields are required.');
      return;
    }

    const editProtocolItem = {
      name: name,
      url: url,
      companyId: company?.id ?? 0,
      id: protocol?.id ?? 0,
      date: protocol?.date ?? new Date(),
      createdBy: protocol?.createdBy ?? '',
    } as ProtocolItem;
    const editProtocolSuccess = await editProtocol(editProtocolItem);

    if (editProtocolSuccess) {
      navigate('/admin/protocols');
    } else {
      showError('Protocol updating failed.');
    }
  };

  return (
    <div style={defaultUiSettings.editAreaStyle}>
      <Grid container spacing={2}>
        <Grid size={12} sx={{textAlign: 'center'}}>
          <h3>Edit Protocol</h3>
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={false}
            id="name"
            label="Name"
            disabled={true}
            value={name}
            onChange={(e) => setName(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <Autocomplete
            options={companyListData}
            value={company}
            onChange={(_, newValue) => setCompany(newValue)}
            getOptionLabel={(option) => (option as CompanyItem).name}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Company"
                sx={{ width: defaultUiSettings.editControlSize }}
              />
            )}
          />
        </Grid>
        <Grid size={12} sx={{textAlign: 'center', alignContent: 'center'}}>
          <TextField
            sx={{ width: defaultUiSettings.editControlSize }}
            required={true}
            id="url"
            label="URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="text"
          />
        </Grid>
        <Grid size={12}>
          <Item>
            <Button onClick={handleEditProtocol}>Save</Button>
            <Button onClick={() => history.back()}>Cancel</Button>
          </Item>
        </Grid>
      </Grid>
    </div>
  );
};
