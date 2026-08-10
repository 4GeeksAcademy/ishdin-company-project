const sampleProducts: Product[] = [
  {
    sku: "SHOE-BLK-42",
    name: "Black Running Shoes - Size 42",
    category: "Fashion",
    weightKg: 0.8,
    // weightKg: -1,
    dimensions: { lengthCm: 35, widthCm: 22, heightCm: 12 },
    warehouse: "Los Angeles",
    stockQuantity: 45,
    minStockThreshold: 20,
    unitCostUSD: 35.0,
    isFragile: false,
    status: "Active",
  },
  {
    sku: "LAPTOP-DELL-15",
    name: "Dell Laptop 15 inch",
    category: "Electronics",
    weightKg: 2.3,
    dimensions: { lengthCm: 40, widthCm: 28, heightCm: 3 },
    warehouse: "Zaragoza",
    stockQuantity: 8,
    minStockThreshold: 10,
    unitCostUSD: 650.0,
    isFragile: true,
    status: "Low stock",
  },
  {
    sku: "PERFUME-COCO-50",
    name: "Coco Perfume 50ml",
    category: "Cosmetics",
    weightKg: 0.3,
    dimensions: { lengthCm: 12, widthCm: 8, heightCm: 15 },
    warehouse: "Los Angeles",
    stockQuantity: 120,
    minStockThreshold: 30,
    unitCostUSD: 85.0,
    isFragile: true,
    status: "Active",
  },
];

const sampleCarriers: Carrier[] = [
  {
    id: "CAR-UPS",
    name: "UPS",
    operatesIn: ["United States"],
    baseRateUSD: 5.0,
    ratePerKgUSD: 1.2,
    ratePerKmUSD: 0.05,
    avgDeliveryDays: 3,
    onTimeRate: 88,
    maxWeightKg: 30,
    handlesFragile: true,
    acceptsPriority: ["Standard", "Express"],
  },
  {
    id: "CAR-SEUR",
    name: "SEUR",
    operatesIn: ["Spain"],
    baseRateUSD: 6.5,
    ratePerKgUSD: 1.5,
    ratePerKmUSD: 0.08,
    avgDeliveryDays: 2,
    onTimeRate: 92,
    maxWeightKg: 25,
    handlesFragile: true,
    acceptsPriority: ["Standard", "Express", "Same-day"],
  },
  {
    id: "CAR-DHL",
    name: "DHL Express",
    operatesIn: ["United States", "Spain"],
    baseRateUSD: 12.0,
    ratePerKgUSD: 2.0,
    ratePerKmUSD: 0.1,
    avgDeliveryDays: 1,
    onTimeRate: 95,
    maxWeightKg: 50,
    handlesFragile: true,
    acceptsPriority: ["Express", "Same-day"],
  },
];


type ProductCategory =
  | "Fashion"
  | "Electronics"
  | "Cosmetics"
  | "Home"
  | "Other";
type WarehouseLocation = "Los Angeles" | "Zaragoza";
type ProductStatus = "Active" | "Low stock" | "Out of stock" | "Discontinued";

type priorityLevel = "Standard"| "Express" | "Same-day";
type AcceptsPriority = priorityLevel[];
type listOfCountry = ["United States", "Spain"];
type OperatesIn = listOfCountry[];



let isValue: boolean = false;

//VALIDATING ALL INPUT PARAMETERS AND RETURN THE MESSAGE IF THE VALIDATION FAILS 

function validationRules(): string | boolean {


  for (let i = 0; i < sampleProducts.length; i++) {

    //sku must not be empty
    if (sampleProducts[i].sku == "") {
      return "sku must not be empty"
    }

    //weightKg must be > 0 and <= 100
    if ((sampleProducts[i].weightKg < 0) || (sampleProducts[i].weightKg > 100)) {
      return `weightKg value must be inbetween 0 and 100 ${sampleProducts[i].weightKg}`
    }

    //All dimensions must be > 0 and <= 200
    if (sampleProducts[i].dimensions.heightCm < 0 || sampleProducts[i].dimensions.heightCm > 200) {
      return "Dimension heightCm value must be inbetween 0 and 200"
    }
    if (sampleProducts[i].dimensions.lengthCm < 0 || sampleProducts[i].dimensions.lengthCm > 200) {
      return "Dimension lengthCm value must be inbetween 0 and 200"
    }
    if (sampleProducts[i].dimensions.widthCm < 0 || sampleProducts[i].dimensions.widthCm > 200) {
      return "Dimension widthCm value must be inbetween 0 and 200"
    }
    //stockQuantity must be >= 0
    if (sampleProducts[i].stockQuantity < 0) {
      return "stockQuantity must be greater than are equal to zero"
    }
    //minStockThreshold must be >= 0
    if (sampleProducts[i].minStockThreshold < 0) {
      return "minStockThreshold must be greater than are equal to zero"
    }
    //unitCostUSD must be > 0
    if (sampleProducts[i].unitCostUSD < 0) {
      return "unitCostUSD must be greater than zero"
    }

  }
  return `All input validation is successful ${isValue = true}`;
}


function filterProductsByWarehouse(sampleProducts: Product[], warehouse: WarehouseLocation): Product[] {
  const resultsWarehouseLocation: Product[] = []
  for (let j = 0; j < sampleProducts.length; j++) {
    console.log(sampleProducts[j].warehouse)
    if (warehouse.toLowerCase() == sampleProducts[j].warehouse.toLowerCase()) {
      resultsWarehouseLocation.push(sampleProducts[j])
    }
  }
  return resultsWarehouseLocation
}

function filterProductsByCategory(sampleProducts: Product[], category: ProductCategory): Product[] {
  const resultsProductCategory: Product[] = []
  for (let j = 0; j < sampleProducts.length; j++) {
    if (category.toLowerCase() == sampleProducts[j].category.toLowerCase()) {
      console.log(sampleProducts[j].category)
      resultsProductCategory.push(sampleProducts[j])
    }
  }
  return resultsProductCategory
}

function filterLowStockProducts(sampleProducts: Product[]): Product[] {
  const resultsLowStock: Product[] = []
  for (let k = 0; k < sampleProducts.length; k++) {
    if (sampleProducts[k].stockQuantity <= sampleProducts[k].minStockThreshold) {
      console.log(sampleProducts[k].status)
      resultsLowStock.push(sampleProducts[k])
    }
  }
  return resultsLowStock
}

function sortProductsByStock(items: Product[], order: "asc" | "desc"): Product[] {

  return [...items].sort((a, b) => {
    if (order === 'asc') {
      return a.stockQuantity - b.stockQuantity
    }
    else {
      return b.stockQuantity - a.stockQuantity
    }

  })
}

function sortCarriersByReliability(carriers: Carrier[], order: "asc" | "desc"): Carrier[] {
  return [...carriers].sort((a, b) => {
    if (order === 'asc') {
      return a.onTimeRate - b.onTimeRate
    }
    else {
      return b.onTimeRate - a.onTimeRate
    }

  })
}

console.log(validationRules())
if (isValue) {
  //function for Warehouse Location
  console.log(filterProductsByWarehouse(sampleProducts, 'Los Angeles'))
  console.log(filterProductsByWarehouse(sampleProducts, 'Zaragoza'))
  //funtion for Product Category  
  console.log(filterProductsByCategory(sampleProducts, 'Fashion'))
  //funtion for Low Stock products  
  console.log(filterLowStockProducts(sampleProducts))
  //funtion for sort the product by stock   
  console.log(sortProductsByStock(sampleProducts, 'desc'))
  //funtion for sort Carrier by reliability   
  console.log(sortCarriersByReliability(sampleCarriers, 'asc'))
}