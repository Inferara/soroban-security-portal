import { ReactNode, useCallback, KeyboardEvent } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Divider,
  ListItemButton,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { EntityAvatar, EntityType } from '../EntityAvatar';

/**
 * Base interface for entities that can be displayed in EntityListCard
 */
export interface BaseListEntity {
  id: number;
  name: string;
}

/**
 * Props for EntityListCard component
 */
export interface EntityListCardProps<T extends BaseListEntity> {
  /** Header title (e.g., "Recent Reports") */
  title: string;
  /** Icon to display in the header */
  headerIcon?: ReactNode;
  /** Total count to display (e.g., "Reports (12)") */
  count?: number;
  /** Array of entities to display */
  items: T[];
  /** Entity type for avatars */
  entityType: EntityType;
  /** Navigation path pattern - use {id} as placeholder for entity ID */
  navigationPattern: string;
  /** Maximum items to display (default: 10) */
  maxItems?: number;
  /** Maximum height for scrollable list (default: 400) */
  maxHeight?: number;
  /** Message to show when list is empty */
  emptyMessage?: string;
  /** Custom renderer for the primary text */
  renderPrimary?: (item: T) => ReactNode;
  /** Custom renderer for the secondary text */
  renderSecondary?: (item: T) => ReactNode;
  /** Sort function to apply to items */
  sortFn?: (a: T, b: T) => number;
  /** Field to use for avatar fallback text (default: 'name') */
  avatarFallbackField?: keyof T;
  /** Avatar size */
  avatarSize?: 'small' | 'medium' | 'large';
}

/**
 * EntityListCard - A card component for displaying lists of related entities.
 *
 * Used in detail page sidebars for displaying:
 * - Protocols audited by an auditor
 * - Recent reports for a company
 * - Vulnerabilities in a report
 *
 * @example Basic usage:
 * ```tsx
 * <EntityListCard
 *   title="Recent Reports"
 *   headerIcon={<Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />}
 *   count={reports.length}
 *   items={reports}
 *   entityType="report"
 *   navigationPattern="/report/{id}"
 *   emptyMessage="No reports available"
 * />
 * ```
 *
 * @example With custom rendering:
 * ```tsx
 * <EntityListCard
 *   title="Protocols"
 *   headerIcon={<Business sx={{ mr: 1, verticalAlign: 'middle' }} />}
 *   items={protocols}
 *   entityType="protocol"
 *   navigationPattern="/protocol/{id}"
 *   sortFn={(a, b) => a.name.localeCompare(b.name)}
 *   renderSecondary={(protocol) => (
 *     <Typography variant="body2" color="text.secondary">
 *       {reports.filter(r => r.protocolId === protocol.id).length} reports
 *     </Typography>
 *   )}
 * />
 * ```
 */
export function EntityListCard<T extends BaseListEntity>({
  title,
  headerIcon,
  count,
  items,
  entityType,
  navigationPattern,
  maxItems = 10,
  maxHeight = 400,
  emptyMessage = 'No items found',
  renderPrimary,
  renderSecondary,
  sortFn,
  avatarFallbackField = 'name',
  avatarSize = 'small',
}: EntityListCardProps<T>) {
  const navigate = useNavigate();

  // Apply sorting if provided
  let displayItems = [...items];
  if (sortFn) {
    displayItems.sort(sortFn);
  }

  // Limit items
  displayItems = displayItems.slice(0, maxItems);

  const handleItemClick = useCallback((item: T) => {
    const path = navigationPattern.replace('{id}', String(item.id));
    navigate(path);
  }, [navigate, navigationPattern]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>, item: T) => {
    // Navigate on Enter or Space key
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleItemClick(item);
    }
  }, [handleItemClick]);

  const getAvatarFallbackText = (item: T): string => {
    const value = item[avatarFallbackField];
    return typeof value === 'string' ? value : item.name;
  };

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }} id={`${title.toLowerCase().replace(/\s+/g, '-')}-list-title`}>
          {headerIcon}
          {title}
          {count !== undefined && ` (${count})`}
        </Typography>

        {displayItems.length > 0 ? (
          <List
            sx={{ maxHeight, overflow: 'auto' }}
            aria-labelledby={`${title.toLowerCase().replace(/\s+/g, '-')}-list-title`}
          >
            {displayItems.map((item, index) => (
              <Box key={item.id}>
                <ListItem disablePadding>
                  <ListItemButton
                    sx={{
                      px: 1,
                      borderRadius: 1,
                    }}
                    onClick={() => handleItemClick(item)}
                    onKeyDown={(e) => handleKeyDown(e, item)}
                    aria-label={`Navigate to ${item.name}`}
                  >
                    <ListItemAvatar>
                      <EntityAvatar
                        entityType={entityType}
                        entityId={item.id}
                        size={avatarSize}
                        fallbackText={getAvatarFallbackText(item)}
                      />
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        renderPrimary ? (
                          renderPrimary(item)
                        ) : (
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                          >
                            {item.name}
                          </Typography>
                        )
                      }
                      secondary={renderSecondary ? renderSecondary(item) : undefined}
                    />
                  </ListItemButton>
                </ListItem>
                {index < displayItems.length - 1 && <Divider />}
              </Box>
            ))}
          </List>
        ) : (
          <Typography
            color="text.secondary"
            sx={{ textAlign: 'center', py: 4 }}
            role="status"
          >
            {emptyMessage}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
