using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Puzzles
{
    class ArraryProducts
    {
        public int[] GetProductsOfAllIntsExceptAtIndex(int[] intArray)
        {
            // We make an array with the length of the input array to
            // hold our products
            int[] productsOfAllIntsExceptAtIndex = new int[intArray.Length];

            // For each integer, we find the product of all the integers
            // before it, storing the total product so far each time
            int productSoFar = 1;
            for (int i = 0; i < intArray.Length; i++)
            {
                productsOfAllIntsExceptAtIndex[i] = productSoFar;
                productSoFar *= intArray[i];
            }

            // For each integer, we find the product of all the integers
            // after it. since each index in products already has the
            // product of all the integers before it, now we're storing
            // the total product of all other integers
            productSoFar = 1;
            for (int i = intArray.Length - 1; i >= 0; i--)
            {
                productsOfAllIntsExceptAtIndex[i] *= productSoFar;
                productSoFar *= intArray[i];
            }

            return productsOfAllIntsExceptAtIndex;
        }
    }
}
