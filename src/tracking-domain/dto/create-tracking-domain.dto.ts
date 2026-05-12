import { IsString, IsNotEmpty } from 'class-validator';

export class CreateTrackingDomainDto {
  @IsString()
  @IsNotEmpty()
  emailAccountId: string;

  @IsString()
  @IsNotEmpty()
  domainName: string;
}
