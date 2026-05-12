import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
export const fileUpload = (folderName: string, file: any) => {

  const publicFolderPath = path.join(
    __dirname,
    '..',
    '..',
    'public',
    `uploads/${folderName}`,
  );
  const allowedExtensions = ['.jpg', '.jpeg', '.png'];

  if (!file) {
    throw new BadRequestException('No file uploaded');
  }

  const fileExtension = path.extname(file.originalname).toLowerCase();

  if (!allowedExtensions.includes(fileExtension)) {
    throw new BadRequestException(
      'Only .jpg, .jpeg, or .png files are allowed',
    );
  }
  const fileName = `${Date.now()}-${file.originalname}`;
  const filePath = path.join(publicFolderPath, fileName);

  // Ensure the uploads folder exists
  if (!fs.existsSync(publicFolderPath)) {
    fs.mkdirSync(publicFolderPath, { recursive: true });
  }

  // Save the file to the public/uploads folder
  fs.writeFileSync(filePath, file.buffer);
  return fileName;
};
