import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { AvatarUpload } from '../AvatarUpload';

// Mock the dialog handler
vi.mock('../../features/dialog-handler/dialog-handler', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
}));

import { showError, showSuccess } from '../../features/dialog-handler/dialog-handler';

const theme = createTheme();

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={theme}>{children}</ThemeProvider>
);

describe('AvatarUpload', () => {
  let setImageCallback: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    setImageCallback = vi.fn();
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with placeholder when no image', () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      expect(screen.getByText('T')).toBeInTheDocument();
    });

    it('renders upload button', () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /upload new avatar/i })).toBeInTheDocument();
    });

    it('renders with base64 image', () => {
      const base64Image = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={base64Image}
        />,
        { wrapper }
      );

      const img = screen.getByAltText('User avatar');
      expect(img).toBeInTheDocument();
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image'));
    });

    it('shows delete button when image exists', () => {
      const base64Image = 'iVBORw0KGgo';

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={base64Image}
        />,
        { wrapper }
      );

      expect(screen.getByRole('button', { name: /remove avatar/i })).toBeInTheDocument();
    });

    it('does not show delete button when no image', () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      expect(screen.queryByRole('button', { name: /remove avatar/i })).not.toBeInTheDocument();
    });
  });

  describe('file upload', () => {
    it('accepts image files', () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      const input = document.querySelector('input[type="file"]');
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('accept', 'image/*');
    });

    it('rejects non-image files', async () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      const textFile = new File(['hello'], 'test.txt', { type: 'text/plain' });

      fireEvent.change(input, { target: { files: [textFile] } });

      expect(showError).toHaveBeenCalledWith('Please select an image file');
    });

    it('rejects files larger than 100KB', async () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;
      // Create a file larger than 100KB
      const largeContent = 'a'.repeat(150 * 1024);
      const largeFile = new File([largeContent], 'large.png', { type: 'image/png' });

      fireEvent.change(input, { target: { files: [largeFile] } });

      expect(showError).toHaveBeenCalledWith('Image size must be less than 100KB');
    });

    it('processes valid image file', async () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      const input = document.querySelector('input[type="file"]') as HTMLInputElement;

      // Create a valid small image file
      const smallImageContent = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const base64 = atob(smallImageContent);
      const bytes = new Uint8Array(base64.length);
      for (let i = 0; i < base64.length; i++) {
        bytes[i] = base64.charCodeAt(i);
      }
      const validFile = new File([bytes], 'test.png', { type: 'image/png' });

      fireEvent.change(input, { target: { files: [validFile] } });

      await waitFor(() => {
        expect(showSuccess).toHaveBeenCalledWith('Image uploaded successfully');
      });
    });
  });

  describe('image removal', () => {
    it('removes image when delete button is clicked', () => {
      const base64Image = 'iVBORw0KGgo';

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={base64Image}
        />,
        { wrapper }
      );

      const deleteButton = screen.getByRole('button', { name: /remove avatar/i });
      fireEvent.click(deleteButton);

      expect(setImageCallback).toHaveBeenCalledWith(null);
    });
  });

  describe('image URL loading', () => {
    it('shows loading state for image URL', () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
          initialImageUrl="https://example.com/avatar.png"
        />,
        { wrapper }
      );

      // Should show loading indicator
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('handles image URL load success', async () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
          initialImageUrl="https://example.com/avatar.png"
        />,
        { wrapper }
      );

      // Find the image with the URL and trigger load
      const img = screen.getByAltText('User avatar');
      fireEvent.load(img);

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
      });
    });

    it('handles image URL load error', async () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
          initialImageUrl="https://example.com/invalid.png"
        />,
        { wrapper }
      );

      // Find the image and trigger error
      const img = screen.getByAltText('User avatar');
      fireEvent.error(img);

      await waitFor(() => {
        // Should fall back to placeholder
        expect(screen.getByText('T')).toBeInTheDocument();
      });
    });
  });

  describe('image type detection', () => {
    it('detects PNG images', () => {
      const pngBase64 = 'iVBORw0KGgoAAAANSUhEUg'; // PNG signature

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={pngBase64}
        />,
        { wrapper }
      );

      const img = screen.getByAltText('User avatar');
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/png'));
    });

    it('detects JPEG images', () => {
      const jpegBase64 = '/9j/4AAQSkZJRgABAQ'; // JPEG signature

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={jpegBase64}
        />,
        { wrapper }
      );

      const img = screen.getByAltText('User avatar');
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'));
    });

    it('detects GIF images', () => {
      const gifBase64 = 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={gifBase64}
        />,
        { wrapper }
      );

      const img = screen.getByAltText('User avatar');
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/gif'));
    });

    it('defaults to JPEG for unknown formats', () => {
      const unknownBase64 = 'ABCDEFGHijk'; // Unknown format

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={unknownBase64}
        />,
        { wrapper }
      );

      const img = screen.getByAltText('User avatar');
      expect(img).toHaveAttribute('src', expect.stringContaining('data:image/jpeg'));
    });
  });

  describe('callback behavior', () => {
    it('calls setImageCallback with initialImage on mount', () => {
      const initialImage = 'testBase64';

      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={initialImage}
        />,
        { wrapper }
      );

      expect(setImageCallback).toHaveBeenCalledWith(initialImage);
    });

    it('calls setImageCallback with null on mount when no image', () => {
      render(
        <AvatarUpload
          placeholder="T"
          setImageCallback={setImageCallback}
          initialImage={null}
        />,
        { wrapper }
      );

      expect(setImageCallback).toHaveBeenCalledWith(null);
    });
  });
});
