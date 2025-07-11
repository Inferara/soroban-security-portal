class DefaultUiSettings{
  editControlSize: string = '850px';
  editAreaStyle: React.CSSProperties = { height: 'calc(-128px + 120vh)', display: 'flow-root', position: 'relative' };
  listAreaStyle: React.CSSProperties = { height: 'calc(-128px + 120vh)', display: 'flow-root', width: `110vw`};
  allowedFileExtensions = ['png', 'jpg', 'bmp', 'pdf', 'docx', 'xlsx', 'pptx', 'txt', 'md', 'wav', 'md', 'wma', 'webm', 'mp3', 'cs', 'sql', 'js', 'ts', 'html', 'json', 'xml', 'yml', 'yaml', 'py', 'zip'];
}

export const defaultUiSettings: DefaultUiSettings = new DefaultUiSettings();