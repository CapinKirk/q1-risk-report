'use client';

import { useRouter } from 'next/navigation';
import { Region, Product } from '@/lib/types';
import { buildFilterURL } from '@/lib/filterData';

interface ReportFilterProps {
  selectedRegions: Region[];
  selectedProducts: Product[];
  onRegionChange: (regions: Region[]) => void;
  onProductChange: (products: Product[]) => void;
}

const ALL_REGIONS: Region[] = ['AMER', 'EMEA', 'APAC'];
const ALL_PRODUCTS: Product[] = ['POR', 'R360'];

export default function ReportFilter({
  selectedRegions,
  selectedProducts,
  onRegionChange,
  onProductChange,
}: ReportFilterProps) {
  const router = useRouter();

  const isAllRegions = selectedRegions.length === 3 || selectedRegions.length === 0;
  const isAllProducts = selectedProducts.length === 2 || selectedProducts.length === 0;

  // Update URL with both filters
  const updateURL = (regions: Region[], products: Product[]) => {
    router.push(buildFilterURL(regions, products), { scroll: false });
  };

  // Product filter handlers
  const handleAllProductsClick = () => {
    onProductChange(ALL_PRODUCTS);
    updateURL(selectedRegions, ALL_PRODUCTS);
  };

  const handleProductClick = (product: Product) => {
    if (selectedProducts.length === 1 && selectedProducts[0] === product) {
      // If clicking the only selected product, go back to all
      onProductChange(ALL_PRODUCTS);
      updateURL(selectedRegions, ALL_PRODUCTS);
    } else {
      // Select only this product
      onProductChange([product]);
      updateURL(selectedRegions, [product]);
    }
  };

  // Region filter handlers
  const handleAllRegionsClick = () => {
    onRegionChange(ALL_REGIONS);
    updateURL(ALL_REGIONS, selectedProducts);
  };

  const handleRegionClick = (region: Region) => {
    if (selectedRegions.length === 1 && selectedRegions[0] === region) {
      // If clicking the only selected region, go back to all
      onRegionChange(ALL_REGIONS);
      updateURL(ALL_REGIONS, selectedProducts);
    } else {
      // Select only this region
      onRegionChange([region]);
      updateURL([region], selectedProducts);
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
    </div>
  );
}
