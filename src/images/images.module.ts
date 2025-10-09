import { Module } from '@nestjs/common';
import { ImagesController } from './images.controller';
import { WebSearchController } from './web-search.controller';
import { ImagesService } from './images.service';
import { CatService } from './cat.service';

@Module({
  controllers: [ImagesController, WebSearchController],
  providers: [ImagesService, CatService],
  exports: [ImagesService, CatService],
})
export class ImagesModule {}