export class SearchItem {
    sender: string = '';
    link: string = '';
    createTime: Date = new Date();
    updateTime: Date = new Date(); 
    sourceContentType: string = '';
    sourceName: string = '';
    texts: SearchItemPartitionText[] = [];
}

export class SearchItemPartitionText {
    text: string = '';
    relevance: number = 0;
    partNumber: number = 0;
}