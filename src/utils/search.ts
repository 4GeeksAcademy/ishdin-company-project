import { Product } from "../types/models";
import { sampleProducts } from "../types/models";

function findProductBySKU(sampleProducts: Product[], sku: string): Product | null {
    let resultskuProduct: Product | null = null;
    for (let i = 0; i < sampleProducts.length; i++) {
        if (sampleProducts[i].sku === sku) {
            resultskuProduct = sampleProducts[i];           
            break;
        }
    }
    return resultskuProduct;
}


console.log(findProductBySKU(sampleProducts,'SHOE-BLK-42'))