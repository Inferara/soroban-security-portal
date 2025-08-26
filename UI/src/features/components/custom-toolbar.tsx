import { Badge, Tooltip } from "@mui/material";
import { ColumnsPanelTrigger, FilterPanelTrigger, Toolbar, ToolbarButton } from "@mui/x-data-grid";
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import FilterListIcon from '@mui/icons-material/FilterList';

export function CustomToolbar() {
  return (
    <Toolbar style={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
      <Tooltip title="Columns">
        <ColumnsPanelTrigger render={<ToolbarButton />}>
          <ViewColumnIcon fontSize="small" />
        </ColumnsPanelTrigger>
      </Tooltip>

      <Tooltip title="Filters">
        <FilterPanelTrigger
          render={(props, state) => (
            <ToolbarButton {...props} color="default">
              <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                <FilterListIcon fontSize="small" />
              </Badge>
            </ToolbarButton>
          )}
        />
      </Tooltip>
    </Toolbar>
  );
}