'use client';

import { useRouter } from 'next/navigation';
import { Region, Product, Category, Source } from '@/lib/types';
import { buildFilterURL } from '@/lib/filterData';

interface ReportFilterProps {
  selectedRegions: Region[];
  selectedProducts: Product[];
  selectedCategories: Category[];
  selectedSources: Source[];
  onRegionChange: (regions: Region[]) => void;
  onProductChange: (products: Product[]) => void;
  onCategoryChange: (categories: Category[]) => void;
  onSourceChange: (sources: Source[]) => void;
}

const ALL_REGIONS: Region[] = ['AMER', 'EMEA', 'APAC'];
const ALL_PRODUCTS: Product[] = ['POR', 'R360'];
const ALL_CATEGORIES: Category[] = ['NEW LOGO', 'EXPANSION', 'MIGRATION'];
const ALL_SOURCES: Source[] = ['INBOUND', 'OUTBOUND', 'AE SOURCED', 'AM SOURCED', 'TRADESHOW', 'PARTNERSHIPS'];

export default function ReportFilter({
  selectedRegions,
  selectedProducts,
  selectedCategories,
  selectedSources,
  onRegionChange,
  onProductChange,
  onCategoryChange,
  onSourceChange,
}: ReportFilterProps) {
  const router = useRouter();

  const isAllRegions = selectedRegions.length === 3 || selectedRegions.length === 0;
  const isAllProducts = selectedProducts.length === 2 || selectedProducts.length === 0;
  const isAllCategories = selectedCategories.length === 3 || selectedCategories.length === 0;
  const isAllSources = selectedSources.length === 6 || selectedSources.length === 0;

  // Update URL with all filters
  const updateURL = (regions: Region[], products: Product[], categories: Category[], sources: Source[]) => {
    router.push(buildFilterURL(regions, products, categories, sources), { scroll: false });
  };

  // Product filter handlers
  const handleAllProductsClick = () => {
    onProductChange(ALL_PRODUCTS);
    updateURL(selectedRegions, ALL_PRODUCTS, selectedCategories, selectedSources);
  };

  const handleProductClick = (product: Product) => {
    if (selectedProducts.length === 1 && selectedProducts[0] === product) {
      onProductChange(ALL_PRODUCTS);
      updateURL(selectedRegions, ALL_PRODUCTS, selectedCategories, selectedSources);
    } else {
      onProductChange([product]);
      updateURL(selectedRegions, [product], selectedCategories, selectedSources);
    }
  };

  // Region filter handlers
  const handleAllRegionsClick = () => {
    onRegionChange(ALL_REGIONS);
    updateURL(ALL_REGIONS, selectedProducts, selectedCategories, selectedSources);
  };

  const handleRegionClick = (region: Region) => {
    if (selectedRegions.length === 1 && selectedRegions[0] === region) {
      onRegionChange(ALL_REGIONS);
      updateURL(ALL_REGIONS, selectedProducts, selectedCategories, selectedSources);
    } else {
      onRegionChange([region]);
      updateURL([region], selectedProducts, selectedCategories, selectedSources);
    }
  };

  // Category filter handlers
  const handleAllCategoriesClick = () => {
    onCategoryChange(ALL_CATEGORIES);
    updateURL(selectedRegions, selectedProducts, ALL_CATEGORIES, selectedSources);
  };

  const handleCategoryClick = (category: Category) => {
    if (selectedCategories.length === 1 && selectedCategories[0] === category) {
      onCategoryChange(ALL_CATEGORIES);
      updateURL(selectedRegions, selectedProducts, ALL_CATEGORIES, selectedSources);
    } else {
      onCategoryChange([category]);
      updateURL(selectedRegions, selectedProducts, [category], selectedSources);
    }
  };

  // Source filter handlers
  const handleAllSourcesClick = () => {
    onSourceChange(ALL_SOURCES);
    updateURL(selectedRegions, selectedProducts, selectedCategories, ALL_SOURCES);
  };

  const handleSourceClick = (source: Source) => {
    if (selectedSources.length === 1 && selectedSources[0] === source) {
      onSourceChange(ALL_SOURCES);
      updateURL(selectedRegions, selectedProducts, selectedCategories, ALL_SOURCES);
    } else {
      onSourceChange([source]);
      updateURL(selectedRegions, selectedProducts, selectedCategories, [source]);
    }
  };

  return (
    <div className="filter-container">
      {/* Product Filter */}
      <div className="filter-bar" data-testid="product-filter">
        <span className="filter-label">Product:</span>
        <button
          className={`filter-btn ${isAllProducts ? 'active' : ''}`}
          onClick={handleAllProductsClick}
          data-testid="product-all"
        >
          All Products
        </button>
        {ALL_PRODUCTS.map(product => (
          <button
            key={product}
            className={`filter-btn product-btn ${!isAllProducts && selectedProducts.includes(product) ? 'active' : ''}`}
            onClick={() => handleProductClick(product)}
            data-testid={`product-${product.toLowerCase()}`}
          >
            {product === 'POR' ? 'Point of Rental' : 'Record360'}
          </button>
        ))}
      </div>

      {/* Region Filter */}
      <div className="filter-bar" data-testid="region-filter">
        <span className="filter-label">Region:</span>
        <button
          className={`filter-btn ${isAllRegions ? 'active' : ''}`}
          onClick={handleAllRegionsClick}
          data-testid="region-all"
        >
          All Regions
        </button>
        {ALL_REGIONS.map(region => (
          <button
            key={region}
            className={`filter-btn ${!isAllRegions && selectedRegions.includes(region) ? 'active' : ''}`}
            onClick={() => handleRegionClick(region)}
            data-testid={`region-${region.toLowerCase()}`}
          >
            {region}
          </button>
        ))}
      </div>

      {/* Category Filter */}
      <div className="filter-bar" data-testid="category-filter">
        <span className="filter-label">Category:</span>
        <button
          className={`filter-btn ${isAllCategories ? 'active' : ''}`}
          onClick={handleAllCategoriesClick}
          data-testid="category-all"
        >
          All Categories
        </button>
        {ALL_CATEGORIES.map(category => (
          <button
            key={category}
            className={`filter-btn ${!isAllCategories && selectedCategories.includes(category) ? 'active' : ''}`}
            onClick={() => handleCategoryClick(category)}
            data-testid={`category-${category.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Source Filter */}
      <div className="filter-bar" data-testid="source-filter">
        <span className="filter-label">Source:</span>
        <button
          className={`filter-btn ${isAllSources ? 'active' : ''}`}
          onClick={handleAllSourcesClick}
          data-testid="source-all"
        >
          All Sources
        </button>
        {ALL_SOURCES.map(source => (
          <button
            key={source}
            className={`filter-btn ${!isAllSources && selectedSources.includes(source) ? 'active' : ''}`}
            onClick={() => handleSourceClick(source)}
            data-testid={`source-${source.toLowerCase().replace(/\s+/g, '-')}`}
          >
            {source}
          </button>
        ))}
      </div>
    </div>
  );
}
