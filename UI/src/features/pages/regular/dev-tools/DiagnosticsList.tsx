import { FC } from 'react';
import { Box, Paper, Stack, Typography } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CompileDiagnostic } from '../../../../api/dev-tools/dev-tools-api';

interface DiagnosticsListProps {
  diagnostics: CompileDiagnostic[];
}

const levelColor = (level: string): string => {
  switch (level) {
    case 'error':
      return 'error.main';
    case 'warning':
      return 'warning.main';
    default:
      return 'info.main';
  }
};

const LevelIcon: FC<{ level: string }> = ({ level }) => {
  if (level === 'error') return <ErrorOutlineIcon fontSize="small" color="error" />;
  if (level === 'warning') return <WarningAmberIcon fontSize="small" color="warning" />;
  return <InfoOutlinedIcon fontSize="small" color="info" />;
};

const DiagnosticRow: FC<{ diag: CompileDiagnostic; depth: number }> = ({ diag, depth }) => {
  const location =
    diag.line != null ? `lib.rs:${diag.line}${diag.column != null ? `:${diag.column}` : ''}` : null;
  return (
    <Box sx={{ pl: depth * 2 }}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
        <Box sx={{ mt: '2px' }}>
          <LevelIcon level={diag.level} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="body2"
            sx={{ fontFamily: 'monospace', color: levelColor(diag.level), wordBreak: 'break-word' }}
          >
            {diag.code ? `[${diag.code}] ` : ''}
            {diag.message}
          </Typography>
          {location && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
              {location}
            </Typography>
          )}
        </Box>
      </Stack>
      {diag.children.map((child, i) => (
        <DiagnosticRow key={i} diag={child} depth={depth + 1} />
      ))}
    </Box>
  );
};

export const DiagnosticsList: FC<DiagnosticsListProps> = ({ diagnostics }) => {
  return (
    <Paper variant="outlined" sx={{ mt: 1.5, p: 2 }}>
      <Stack spacing={1.5}>
        {diagnostics.map((d, i) => (
          <DiagnosticRow key={i} diag={d} depth={0} />
        ))}
      </Stack>
    </Paper>
  );
};
