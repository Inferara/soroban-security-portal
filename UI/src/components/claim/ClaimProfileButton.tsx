import React, { useState } from 'react';
import { Button, Stack } from '@mui/material';
import { ClaimProfileDialog } from './ClaimProfileDialog';

interface Props {
  entityType: 'protocol' | 'auditor';
  entityId: number;
}

export const ClaimProfileButton: React.FC<Props> = ({ entityType, entityId }) => {
  const [open, setOpen] = useState(false);
  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="outlined"
        color="primary"
        size="small"
        onClick={() => setOpen(true)}
      >
        Claim this profile
      </Button>
      <ClaimProfileDialog open={open} onClose={() => setOpen(false)} entityType={entityType} entityId={entityId} />
    </Stack>
  );
};

export default ClaimProfileButton;
