using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Puzzles
{
    class Program
    {
        static void Main(string[] args)
        {
            var quiz = new ArraryPivot();
            var array = new int[]{ 1, 8, 4, 3, 2 };

            Console.WriteLine("GetPivotIndex(array): "+ quiz.GetPivotIndex(array));
            Console.ReadLine();
        }
    }
}
