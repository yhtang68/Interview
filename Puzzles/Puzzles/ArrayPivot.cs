using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Puzzles
{
    class ArraryPivot
    {
        public int GetPivotIndex(int[] intArray)
        {
        
            if (intArray.Length == 0 || intArray == null)
            {
                return -1;
            }

            else if (intArray.Length == 1)
            {
                return 0;
            }

            else
            {
                for (int i = 0; i < intArray.Length-1; i++)
                {
                    int curr = i;
                    int next = i+1;

                    if (intArray[next] < intArray[curr])
                        return next;

                    if (next == intArray.Length-1)
                        return next;

                    else
                        continue;

                }
                
            }

            return 0;

        }
    }
}
