import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  Stack,
} from '@mui/material';
import { submitProtocolClaimCall, submitAuditorClaimCall } from '../../api/soroban-security-portal/soroban-security-portal-api';

type EntityType = 'protocol' | 'auditor';

interface Props {
  open: boolean;
  onClose: () => void;
  entityType: EntityType;
  entityId: number;
}

const methods = [
  { value: 'DNS', label: 'DNS TXT record' },
  { value: 'WebsiteMeta', label: 'Website meta tag' },
  { value: 'Social', label: 'Social media confirmation' },
];

export const ClaimProfileDialog: React.FC<Props> = ({ open, onClose, entityType, entityId }) => {
  const [method, setMethod] = useState<string>(methods[0].value);
  const [data, setData] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      if (entityType === 'protocol') {
        await submitProtocolClaimCall(entityId, method, data || undefined);
      } else {
        await submitAuditorClaimCall(entityId, method, data || undefined);
      }
      onClose();
    } catch (err) {
      console.error('Claim submit error', err);
      // swallow; UI can be improved to show error
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Claim this profile</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            select
            label="Verification Method"
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            size="small"
          >
            {methods.map(m => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </TextField>

          <TextField
            label="Verification data (value or URL)"
            value={data}
            onChange={(e) => setData(e.target.value)}
            size="small"
            helperText="For DNS: TXT value. For website: meta tag content. For social: profile URL or post URL."
            fullWidth
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>Submit claim</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ClaimProfileDialog;
