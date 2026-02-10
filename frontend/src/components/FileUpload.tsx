/**
 * FileUpload component with drag-and-drop support.
 *
 * Uses react-dropzone for file selection and presigned S3 uploads.
 * Handles upload progress and error states.
 */

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { requestPresignedUrl, uploadToS3, confirmUpload } from '../services/api';

interface FileUploadProps {
  onFilesUploaded: (fileIds: string[]) => void;
  accept?: Record<string, string[]>;
  maxSize?: number;
  maxFiles?: number;
}

interface UploadStatus {
  filename: string;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export function FileUpload({
  onFilesUploaded,
  accept = { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
  maxSize = 10 * 1024 * 1024, // 10MB default
  maxFiles = 3,
}: FileUploadProps) {
  const [uploadStatuses, setUploadStatuses] = useState<UploadStatus[]>([]);
  const [uploadedFileIds, setUploadedFileIds] = useState<string[]>([]);

  const onDrop = async (acceptedFiles: File[], rejectedFiles: any[]) => {
    // Show rejected file errors
    if (rejectedFiles.length > 0) {
      const rejectedStatuses: UploadStatus[] = rejectedFiles.map((rejection) => ({
        filename: rejection.file.name,
        status: 'error',
        error: rejection.errors.map((e: any) => e.message).join(', '),
      }));

      setUploadStatuses((prev) => [...prev, ...rejectedStatuses]);
    }

    // Upload accepted files
    if (acceptedFiles.length === 0) return;

    // Initialize upload statuses
    const initialStatuses: UploadStatus[] = acceptedFiles.map((file) => ({
      filename: file.name,
      status: 'uploading',
    }));

    setUploadStatuses((prev) => [...prev, ...initialStatuses]);

    const newFileIds: string[] = [];

    // Upload each file
    for (let i = 0; i < acceptedFiles.length; i++) {
      const file = acceptedFiles[i];

      try {
        // Step 1: Request presigned URL
        const presignedData = await requestPresignedUrl(
          file.name,
          file.type,
          file.size,
          'evidence'
        );

        // Step 2: Upload to S3
        await uploadToS3(presignedData.url, presignedData.fields, file);

        // Step 3: Confirm upload
        await confirmUpload(presignedData.file_id, 'evidence');

        // Update status to success
        setUploadStatuses((prev) =>
          prev.map((status) =>
            status.filename === file.name
              ? { ...status, status: 'success' }
              : status
          )
        );

        newFileIds.push(presignedData.file_id);
      } catch (error) {
        // Update status to error
        setUploadStatuses((prev) =>
          prev.map((status) =>
            status.filename === file.name
              ? {
                  ...status,
                  status: 'error',
                  error: error instanceof Error ? error.message : 'Upload failed',
                }
              : status
          )
        );
      }
    }

    // Update parent component with uploaded file IDs
    if (newFileIds.length > 0) {
      const allFileIds = [...uploadedFileIds, ...newFileIds];
      setUploadedFileIds(allFileIds);
      onFilesUploaded(allFileIds);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept,
    maxSize,
    maxFiles,
  });

  return (
    <div>
      <div
        {...getRootProps()}
        style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '20px',
          textAlign: 'center',
          cursor: 'pointer',
          backgroundColor: isDragActive ? '#e8f5e9' : '#fafafa',
        }}
        role="button"
        aria-label="Upload evidence photos"
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>Drop the files here...</p>
        ) : (
          <p>
            Drag and drop evidence photos here, or click to select files
            <br />
            <small>(Max {maxFiles} files, {Math.round(maxSize / 1024 / 1024)}MB each)</small>
          </p>
        )}
      </div>

      {/* Upload progress */}
      {uploadStatuses.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <h4>Upload Status:</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {uploadStatuses.map((status, index) => (
              <li key={index} style={{ padding: '4px 0' }}>
                <span>{status.filename}: </span>
                {status.status === 'uploading' && <span>Uploading...</span>}
                {status.status === 'success' && <span style={{ color: 'green' }}>Success</span>}
                {status.status === 'error' && (
                  <span style={{ color: 'red' }}>Error: {status.error}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
