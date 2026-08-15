import { Product, Shipment, Carrier } from "../types/models";
import { sampleCarriers, sampleProducts, sampleShipment } from "../types/models";

function validateProduct(product: Product[]): { valid: boolean, errors: string[] } {

  // const message:{ valid: boolean, errors: string[] } = 

  for (let i = 0; i < sampleProducts.length; i++) {

    //sku must not be empty
    if (sampleProducts[i].sku == "") {
      return "sku must not be empty"
    }

    //weightKg must be > 0 and <= 100
    if ((sampleProducts[i].weightKg < 0) || (sampleProducts[i].weightKg > 100)) {
      return { valid: false, errors: ["weightKg value must be inbetween 0 and 100"] }
    }

    //All dimensions must be > 0 and <= 200
    if (sampleProducts[i].dimensions.heightCm < 0 || sampleProducts[i].dimensions.heightCm > 200) {
      return { valid: false, errors: ["Dimension heightCm value must be inbetween 0 and 200"] }
    }
    if (sampleProducts[i].dimensions.lengthCm < 0 || sampleProducts[i].dimensions.lengthCm > 200) {
      return { valid: false, errors: ["Dimension lengthCm value must be inbetween 0 and 200"] }
    }
    if (sampleProducts[i].dimensions.widthCm < 0 || sampleProducts[i].dimensions.widthCm > 200) {
      return { valid: false, errors: ["Dimension widthCm value must be inbetween 0 and 200"] }
    }
    //stockQuantity must be >= 0
    if (sampleProducts[i].stockQuantity < 0) {
      return { valid: false, errors: ["stockQuantity must be greater than are equal to zero"] }
    }
    //minStockThreshold must be >= 0
    if (sampleProducts[i].minStockThreshold < 0) {
      return { valid: false, errors: ["minStockThreshold must be greater than are equal to zero"] }
    }
    //unitCostUSD must be > 0
    if (sampleProducts[i].unitCostUSD < 0) {
      return { valid: false, errors: ["unitCostUSD must be greater than zero"] }
    }

  }
  return { valid: true, errors: [] };
}









console.log(validateProduct(sampleProducts))




