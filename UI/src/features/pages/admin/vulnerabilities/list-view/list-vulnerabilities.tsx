import ClearIcon from '@mui/icons-material/Clear';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import {
  Box,
  IconButton,
  Link,
  Tooltip,
  Typography,
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
} from '@mui/x-data-grid';
import { FC, useEffect, useState } from 'react';

import { Vulnerability } from '../../../../../api/soroban-security-portal/models/vulnerability.ts';
import { CurrentPageState } from '../../admin-main-window/current-page-slice.ts';
import { useListVulnerabilities } from './hooks/index.ts';
import { ConfirmDialog } from '../../admin-main-window/confirm-dialog.tsx';
import { CustomToolbar } from '../../../../components/custom-toolbar.tsx';
import { defaultUiSettings } from '../../../../../api/soroban-security-portal/models/ui-settings.ts';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import { CodeBlock } from '../../../../../components/CodeBlock.tsx';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import EditIcon from '@mui/icons-material/Edit';
import { useNavigate } from 'react-router-dom';


export const VulnerabilityManagement: FC = () => {

  const currentPageState: CurrentPageState = {
    pageName: 'Vulnerabilities',
    pageCode: 'vulnerabilities',
    pageUrl: window.location.pathname,
    routePath: 'admin/vulnerabilities',
  };

  const { vulnerabilityListData, vulnerabilityApprove, vulnerabilityRemove, vulnerabilityReject } = useListVulnerabilities({ currentPageState });
  const [vulnerabilityIdToRemove, setVulnerabilityIdToRemove] = useState(0);
  const [collapsedDescriptions, setCollapsedDescriptions] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    setCollapsedDescriptions(new Set(vulnerabilityListData.map(vuln => vuln.id.toString())));
  }, [vulnerabilityListData]);

  const removeVulnerabilityConfirmed = async () => {
    await vulnerabilityRemove(vulnerabilityIdToRemove);
    setVulnerabilityIdToRemove(0);
  };

  const shouldShowCollapse = (description: string) => {
    const lines = getDescriptionLines(description);
    return lines.length > 6;
  };
  
  const getDescriptionLines = (description: string) => {
    return description.split('\n');
  };

  const getTruncatedDescription = (description: string) => {
    const lines = getDescriptionLines(description);
    if (lines.length <= 6) {
      return description;
    }
    return lines.slice(0, 6).join('\n');
  };

  const toggleDescriptionCollapse = (id: string) => {
    setCollapsedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const columnsData: GridColDef[] = [
    {
      field: 'actions',
      headerName: 'Actions',
      width: 220,
      sortable: false,
      filterable: false,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div style={{ display: 'flex', gap: 4 }}>
          <Tooltip title="Remove Vulnerability">
            <IconButton onClick={() => setVulnerabilityIdToRemove(params.row.id)}>
              <ClearIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Approve Vulnerability">
            <IconButton onClick={() => vulnerabilityApprove(params.row.id)}>
              <CheckCircleIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Reject Vulnerability">
            <IconButton onClick={() => vulnerabilityReject(params.row.id)}>
              <CancelIcon sx={{ color: 'red' }} />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Vulnerability">
            <IconButton onClick={() => navigate(`/admin/vulnerabilities/edit?vulnerabilityId=${params.row.id}`)}>
              <EditIcon sx={{ color: 'green' }} />
            </IconButton>
          </Tooltip>
        </div>
      ),
    } as GridColDef,
    {
      field: 'title',
      headerName: 'Title',
      width: 250,
    } as GridColDef,
    {
      field: 'status',
      headerName: 'Status',
      width: 180,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => {
        const getStatusColor = (status: string) => {
          switch (status.toLowerCase()) {
            case 'new':
              return '#DAA520'; // dark yellow
            case 'approved':
              return '#4CAF50'; // green
            case 'rejected':
              return '#F44336'; // red
            default:
              return 'inherit';
          }
        };
        return (
          <span style={{ 
            color: getStatusColor(params.row.status),
            fontWeight: 'bold'
          }}>
            {params.row.status}
          </span>
        );
      },
    } as GridColDef,
    {
      field: 'description',
      headerName: 'Description',
      width: 950,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => {
        return (
          <>
          <ReactMarkdown
            skipHtml={false}
            remarkPlugins={[remarkParse, remarkGfm, remarkMath, remarkRehype]}
            rehypePlugins={[rehypeRaw]}
            components={{
              code: (props) => {
                const { node, className, children, ...rest } = props;
                const inline = (props as any).inline;
                const match = /language-(\w+)/.exec(className || '');
                if (!inline && match) {
                  return (
                    <CodeBlock className={className} {...rest}>
                      {String(children).replace(/\n$/, '')}
                    </CodeBlock>
                  );
                } else {
                  return (
                    <CodeBlock className={className} inline={true} {...rest}>
                      {String(children).replace(/\n$/, '')}
                    </CodeBlock>
                  );
                }
              }
            }}
          >
            {collapsedDescriptions.has(params.row.id.toString()) ? getTruncatedDescription(params.row.description) : params.row.description}
          </ReactMarkdown>
          {shouldShowCollapse(params.row.description) && (
            <Box sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
              <IconButton
                onClick={() => toggleDescriptionCollapse(params.row.id.toString())}
              >
                {collapsedDescriptions.has(params.row.id.toString()) ? <ExpandMoreIcon /> : <ExpandLessIcon />}
              </IconButton>
              <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                {collapsedDescriptions.has(params.row.id.toString()) ? 'Show more' : 'Show less'}
              </Typography>
            </Box>
          )}
          </>
        );
      },
    } as GridColDef,
    {
      field: 'details',
      headerName: 'Details',
      width: 420,
      renderCell: (params: GridRenderCellParams<Vulnerability>) => (
        <div>
          <div>Tags: <span style={{ color: 'gray' }}>{params.row.categories.join(', ')}</span></div>
          <div>Source: <span style={{ color: 'gray' }}>{params.row.source}</span></div>
          <div>Project: <span style={{ color: 'gray' }}>{params.row.project}</span></div>
          <div>Severity: <span style={{ color: 'gray' }}>{params.row.severity}</span></div>
          <div>Last Action: <span style={{ color: 'gray' }}>{params.row.lastActionBy}</span></div>
          <div>Last Action At: <span style={{ color: 'gray' }}>{params.row.lastActionAt?.split('.')[0].replace('T', ' ')}</span></div>
          <div>Report URL: <Link style={{ color: 'gray' }} href={params.row.reportUrl} target="_blank" rel="noopener">{params.row.reportUrl}</Link></div>
        </div>
      ),
    } as GridColDef,
  ];

  return (
    <div style={defaultUiSettings.listAreaStyle}>
      <div style={{ height: 'calc(110vh - 64px)' }}>
        <DataGrid
          getRowId={(row: Vulnerability) => row.id}
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-cell': {
              whiteSpace: 'normal',
              display: 'grid',
              alignContent: 'center',
              minHeight: 50,
            },
          }}
          rows={vulnerabilityListData}
          columns={columnsData}
          showToolbar={true}
          slots={{
            toolbar: CustomToolbar,
          }}
          isRowSelectable={() => false}
        />
      </div>

      <ConfirmDialog
        title="Remove Vulnerability"
        message="Are you sure you want to remove this Vulnerability?"
        okButtonText="Yes"
        cancelButtonText="No"
        onConfirm={removeVulnerabilityConfirmed}
        onCancel={() => setVulnerabilityIdToRemove(0)}
        show={vulnerabilityIdToRemove !== 0}
      />
    </div>
  );
};
