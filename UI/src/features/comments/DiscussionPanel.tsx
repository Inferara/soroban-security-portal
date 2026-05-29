import { FC } from 'react';
import { CommentEntityType } from '../../api/soroban-security-portal/models/comment';
import { CommentList } from './CommentList';

interface DiscussionPanelProps {
  entityType: CommentEntityType;
  entityId: number;
}

export const DiscussionPanel: FC<DiscussionPanelProps> = ({ entityType, entityId }) => (
  <CommentList entityType={entityType} entityId={entityId} />
);
