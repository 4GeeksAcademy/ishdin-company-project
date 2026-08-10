interface Product {
  sku: string; // Stock Keeping Unit (e.g., "SHOE-BLK-42")
  name: string; // Product name
  category: ProductCategory; // Product category
  weightKg: number; // Weight in kilograms
  dimensions: Dimensions; // Length, width, height in cm
  warehouse: WarehouseLocation; // Current warehouse
  stockQuantity: number; // Available units
  minStockThreshold: number; // Minimum stock before alert
  unitCostUSD: number; // Cost per unit in USD
  isFragile: boolean; // Requires special handling
  status: ProductStatus; // Current status
}

interface Carrier {
    id: string;
    name: string;
    operatesIn: operatesIn;
    baseRateUSD: number;
    ratePerKgUSD: number;
    ratePerKmUSD: number;
    avgDeliveryDays: number;
    onTimeRate: number;
    maxWeightKg: number;
    handlesFragile: boolean;
    acceptsPriority: AcceptsPriority;
}

interface Dimensions {
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

