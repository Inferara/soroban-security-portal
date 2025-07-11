import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

interface ConfirmDialogProps {
  title: string,
  message: React.ReactNode,
  okButtonText: string,
  cancelButtonText: string,
  show: boolean,
  onConfirm: () => void,
  onCancel: () => void
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = (props: ConfirmDialogProps) => {
  const handleOk = () => {
    props.onConfirm();
  };

  const handleCancel = () => {
    props.onCancel();
  };

  return (
    <Dialog
      open={props.show}
      onClose={handleCancel}
    >
      <DialogTitle>
        {props.title}
      </DialogTitle>
      <DialogContent>
        <DialogContentText>
          {props.message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleCancel}>{props.cancelButtonText}</Button>
        <Button onClick={handleOk} autoFocus>{props.okButtonText}</Button>
      </DialogActions>
    </Dialog>
  );
}