import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { WebSearchController } from './web-search.controller';
import { ImagesService } from './images.service';

@Module({
  controllers: [ImagesController, WebSearchController],
  providers: [ImagesService],
  exports: [ImagesService],
})
export class ImagesModule {}