import { PartialType } from '@nestjs/mapped-types';
import { CreateDocumentDto } from './create-document.dto';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateDocumentDto extends PartialType(CreateDocumentDto) {}
