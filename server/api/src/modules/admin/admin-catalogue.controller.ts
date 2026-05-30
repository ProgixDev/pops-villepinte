import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminCatalogueService } from './admin-catalogue.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto, ToggleAvailabilityDto } from './dto/update-product.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { ReorderCategoriesDto } from './dto/reorder-categories.dto';
import { CreateSupplementDto } from './dto/create-supplement.dto';
import { UpdateSupplementDto } from './dto/update-supplement.dto';
import { ManageProductSupplementsDto } from './dto/manage-product-supplements.dto';
import { ManageProductVariantsDto } from './dto/manage-product-variants.dto';
import { SetHomeSignaturesDto } from './dto/set-home-signatures.dto';
import { SetHomeAdviceDto } from './dto/set-home-advice.dto';
import { UpdateHomeContentDto } from './dto/update-home-content.dto';
import { UpdateShopSettingsDto } from './dto/update-shop-settings.dto';
import { CreateAccompagnementDto } from './dto/create-accompagnement.dto';
import { UpdateAccompagnementDto } from './dto/update-accompagnement.dto';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminCatalogueController {
  constructor(private readonly catalogueService: AdminCatalogueService) {}

  // Read endpoints (admin sees everything, including unavailable / inactive)
  @Get('categories')
  listCategories() {
    return this.catalogueService.listCategories();
  }

  @Get('products')
  listProducts() {
    return this.catalogueService.listProducts();
  }

  @Get('products/:id')
  getProduct(@Param('id') id: string) {
    return this.catalogueService.getProduct(id);
  }

  @Get('supplements')
  listSupplements() {
    return this.catalogueService.listSupplements();
  }

  // Products
  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.catalogueService.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.catalogueService.updateProduct(id, dto);
  }

  @Delete('products/:id')
  deleteProduct(@Param('id') id: string) {
    return this.catalogueService.deleteProduct(id);
  }

  @Patch('products/:id/availability')
  toggleAvailability(
    @Param('id') id: string,
    @Body() dto: ToggleAvailabilityDto,
  ) {
    return this.catalogueService.toggleAvailability(id, dto);
  }

  @Put('products/:id/supplements')
  setProductSupplements(
    @Param('id') id: string,
    @Body() dto: ManageProductSupplementsDto,
  ) {
    return this.catalogueService.setProductSupplements(id, dto);
  }

  @Put('products/:id/variants')
  setProductVariants(
    @Param('id') id: string,
    @Body() dto: ManageProductVariantsDto,
  ) {
    return this.catalogueService.setProductVariants(id, dto);
  }

  // Categories
  @Post('categories')
  createCategory(@Body() dto: CreateCategoryDto) {
    return this.catalogueService.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.catalogueService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.catalogueService.deleteCategory(id);
  }

  @Put('categories/order')
  reorderCategories(@Body() dto: ReorderCategoriesDto) {
    return this.catalogueService.reorderCategories(dto);
  }

  // Supplements
  @Post('supplements')
  createSupplement(@Body() dto: CreateSupplementDto) {
    return this.catalogueService.createSupplement(dto);
  }

  @Patch('supplements/:id')
  updateSupplement(@Param('id') id: string, @Body() dto: UpdateSupplementDto) {
    return this.catalogueService.updateSupplement(id, dto);
  }

  @Delete('supplements/:id')
  deleteSupplement(@Param('id') id: string) {
    return this.catalogueService.deleteSupplement(id);
  }

  // Home signatures
  @Get('home/signatures')
  getHomeSignatures() {
    return this.catalogueService.getHomeSignatures();
  }

  @Put('home/signatures')
  setHomeSignatures(@Body() dto: SetHomeSignaturesDto) {
    return this.catalogueService.setHomeSignatures(dto);
  }

  // Home advice ("Notre conseil" — cart suggestions)
  @Get('home/advice')
  getHomeAdvice() {
    return this.catalogueService.getHomeAdvice();
  }

  @Put('home/advice')
  setHomeAdvice(@Body() dto: SetHomeAdviceDto) {
    return this.catalogueService.setHomeAdvice(dto);
  }

  // Home content (bandeau marquee + bloc story)
  @Get('home/content')
  getHomeContent() {
    return this.catalogueService.getHomeContent();
  }

  @Put('home/content')
  updateHomeContent(@Body() dto: UpdateHomeContentDto) {
    return this.catalogueService.updateHomeContent(dto);
  }

  // Shop settings (public-facing opening days/hours strings)
  @Get('shop/settings')
  getShopSettings() {
    return this.catalogueService.getShopSettings();
  }

  @Put('shop/settings')
  updateShopSettings(@Body() dto: UpdateShopSettingsDto) {
    return this.catalogueService.updateShopSettings(dto);
  }

  // Accompagnements (drinks / simple sides)
  @Get('accompagnements')
  listAccompagnements() {
    return this.catalogueService.listAccompagnements();
  }

  @Get('accompagnements/:id')
  getAccompagnement(@Param('id') id: string) {
    return this.catalogueService.getAccompagnement(id);
  }

  @Post('accompagnements')
  createAccompagnement(@Body() dto: CreateAccompagnementDto) {
    return this.catalogueService.createAccompagnement(dto);
  }

  @Patch('accompagnements/:id')
  updateAccompagnement(
    @Param('id') id: string,
    @Body() dto: UpdateAccompagnementDto,
  ) {
    return this.catalogueService.updateAccompagnement(id, dto);
  }

  @Delete('accompagnements/:id')
  deleteAccompagnement(@Param('id') id: string) {
    return this.catalogueService.deleteAccompagnement(id);
  }
}
