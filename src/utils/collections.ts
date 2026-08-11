import { Carrier, Product, ProductCategory, WarehouseLocation } from "../types/models";
import { sampleProducts, sampleCarriers } from "../types/models";

// type ProductCategory =
//   | "Fashion"
//   | "Electronics"
//   | "Cosmetics"
//   | "Home"
//   | "Other";
// type WarehouseLocation = "Los Angeles" | "Zaragoza";
// type ProductStatus = "Active" | "Low stock" | "Out of stock" | "Discontinued";

// type priorityLevel = "Standard"| "Express" | "Same-day";
// type AcceptsPriority = priorityLevel[];
// type listOfCountry = ["United States", "Spain"];
// type OperatesIn = listOfCountry[];



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
  // function for Warehouse Location
  console.log(filterProductsByWarehouse(sampleProducts, 'Los Angeles'))
  console.log(filterProductsByWarehouse(sampleProducts, 'Zaragoza'))
  //funtion for Product Category  
  console.log(filterProductsByCategory(sampleProducts, 'Fashion'))
  //funtion for Low Stock products  
  console.log(filterLowStockProducts(sampleProducts))
  //funtion for sort the product by stock   
  console.log(sortProductsByStock(sampleProducts, 'asc'))
  //funtion for sort Carrier by reliability   
  console.log(sortCarriersByReliability(sampleCarriers, 'asc'))
}