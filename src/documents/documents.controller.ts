import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFiles,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { DocumentsService } from './documents.service';
import { FileFieldsInterceptor } from '@nestjs/platform-express';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  private createSuccessResponse(data: any) {
    return { status: 'success', data };
  }

  @Post('upload-documents')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'landlordInsurancePolicy' },
      { name: 'utilityAndMaintenance' },
      { name: 'otherDocuments' },
    ]),
  )
  async uploadDocuments(
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      landlordInsurancePolicy?: Express.Multer.File[];
      utilityAndMaintenance?: Express.Multer.File[];
      otherDocuments?: Express.Multer.File[];
    },
    @Body() body: any,
    @Res() res: Response,
  ) {
    const created = await this.documentsService.createUnitDocument({
      ...body,
      ...files,
    });

    console.log({created});
    
    return res
      .status(HttpStatus.CREATED)
      .json(this.createSuccessResponse(created));
  }

  @Patch(':id')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'landlordInsurancePolicy' },
      { name: 'utilityAndMaintenance' },
      { name: 'otherDocuments' },
    ]),
  )
  async updateDocument(
    @Param('id') id: string,
    @UploadedFiles()
    files: {
      file?: Express.Multer.File[];
      landlordInsurancePolicy?: Express.Multer.File[];
      utilityAndMaintenance?: Express.Multer.File[];
      otherDocuments?: Express.Multer.File[];
    },
    @Body() body: any,
    @Res() res: Response,
  ) {
    const updated = await this.documentsService.update(id, {
      ...body,
      ...files,
    });
    return res
      .status(HttpStatus.OK)
      .json(this.createSuccessResponse(updated));
  }

  @Get()
  async findAll(@Res() res: Response) {
    const all = await this.documentsService.findAll();
    return res
      .status(HttpStatus.OK)
      .json(this.createSuccessResponse(all));
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const found = await this.documentsService.findOne(id);
    return res
      .status(HttpStatus.OK)
      .json(this.createSuccessResponse(found));
  }

  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    await this.documentsService.remove(id);
    return res
      .status(HttpStatus.NO_CONTENT)
      .send();  // no body on successful delete
  }
}
