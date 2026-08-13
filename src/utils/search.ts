import { Product, Shipment } from "../types/models";
import { sampleProducts, sampleShipment } from "../types/models";

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
function findShipmentById(shipments: Shipment[], id: string): Shipment | null{
    let resultsShipmentId : Shipment | null = null;
    for (let j=0;j<shipments.length;j++){
        if(shipments[j].id===id){
            resultsShipmentId=shipments[j]
        }
    }
    return resultsShipmentId;
}

function binarySearchProductByWeight(sampleProducts: Product[], targetWeight: number): number{
    let low=0;
    let resultIndex :number = -1
    let high=sampleProducts.length - 1;
    const sortedProducts = sampleProducts.sort((a,b) => a.weightKg - b.weightKg)
    for(let num=0;num < sortedProducts.length;num++){
        let mid = Math.floor((low + high)/2)
        if (sortedProducts[mid].weightKg === targetWeight){
            resultIndex = mid;
        }
        else if(sortedProducts[mid].weightKg < targetWeight){
            low = mid + 1;
        }
        else{
            high=mid;
        }
    }
    return resultIndex;
}


//function find product by SKU
console.log(findProductBySKU(sampleProducts,'SHOE-BLK-42'))
// function for find shipment by ID 
console.log(findShipmentById(sampleShipment,'SH-2024-8821'))
// funtion for Binary search product by weight 
console.log(binarySearchProductByWeight(sampleProducts,2.4))