import { Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { FavoritesService } from './favorites.service';

@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favorites: FavoritesService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.favorites.list(user.id);
  }

  @Post(':productId')
  add(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
  ) {
    return this.favorites.add(user.id, productId);
  }

  @Delete(':productId')
  remove(
    @CurrentUser() user: { id: string },
    @Param('productId') productId: string,
  ) {
    return this.favorites.remove(user.id, productId);
  }
}
