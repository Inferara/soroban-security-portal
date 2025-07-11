import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Slide from '@mui/material/Slide';
import { TransitionProps } from '@mui/material/transitions';
import { ErrorType, selectCurrentError } from './current-error-slice';
import { useAppDispatch, useAppSelector } from '../../../../app/hooks';
import { closeCurrentError } from './current-error-slice';

const Transition = React.forwardRef(function Transition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  props: TransitionProps & {children: React.ReactElement<unknown, any>},
  ref: React.Ref<unknown>,
) {
  return <Slide direction="up" ref={ref} {...props} />;
});

export default function ErrorDialog() {
  const currentError = useAppSelector(selectCurrentError);
  const dispatch = useAppDispatch();

  const handleClose = () => {
    dispatch(closeCurrentError());
  };

  const getDialogTitle = () => {
    switch (currentError.errorType) {
      case ErrorType.Error:
        return "Error";
      case ErrorType.Warning:
        return "Warning";
      case ErrorType.Success:
        return "Success";
      default:
        return "Message";
    }
  };

  const getDialogColor = () => {
    switch (currentError.errorType) {
      case ErrorType.Error:
        return "error";
      case ErrorType.Warning:
        return "warning";
      case ErrorType.Success:
        return "success";
      default:
        return "primary";
    }
  };

  return (
    <React.Fragment>
      <Dialog
          open={!currentError.isClosed}
          TransitionComponent={Transition}
          keepMounted
          onClose={handleClose}
          aria-describedby="alert-dialog-slide-description"
        >
        <DialogTitle color={getDialogColor()}>{getDialogTitle()}</DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-slide-description">
            {currentError.errorText}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color={getDialogColor()}>OK</Button>
        </DialogActions>
      </Dialog>
    </React.Fragment> 
  );
}