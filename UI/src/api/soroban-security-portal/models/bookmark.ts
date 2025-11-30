export interface Bookmark {
    id: number;
    itemId: number;
    bookmarkType: BookmarkType;
    title: string;
    description: string;
}

export enum BookmarkType {
    Report = 1,
    Vulnerability = 2
}

export interface CreateBookmark {
    id?: number;
    loginId: number;
    itemId: number;
    bookmarkType: BookmarkType;
}
