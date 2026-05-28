using System;
using System.Collections.Generic;
using System.Linq;

namespace MySocialApp
{
    // =========================================================================
    // 1. THE DATA MODEL CLASS
    // =========================================================================
    public class Friend
    {
        // Unique identifier for each node
        public string Email { get; set; }
        
        // Adjacency list storing links directly to other node instances
        public List<Friend> Friends { get; set; } = new List<Friend>();

        // Constructor to enforce initialization with an identifier
        public Friend(string email)
        {
            Email = email;
        }

        /// <summary>
        /// Uses the generic BFS extension to check if a target friend is reachable in the web.
        /// </summary>
        public bool IsFriend(Friend targetFriend)
        {
            // Safeguard against missing search parameters
            if (targetFriend == null) return false;

            // 1. 'this' implicitly maps the current object instance to 'startNode'
            // 2. 'f => f.Friends' tells the engine how to find the next layer of nodes
            // 3. '.Any(...)' processes the streamed data lazily until a match is found
            return this.BreadthFirstSearch(f => f.Friends)
                       .Any(f => f.Email == targetFriend.Email);
        }

        /// <summary>
        /// Checks if a connection exists in EITHER direction (this -> target OR target -> this).
        /// </summary>
        public bool IsFriend2(Friend targetFriend)
        {
            if (targetFriend == null) return false;
            if (this.Email == targetFriend.Email) return true;

            // 1. Check if "this" can reach "targetFriend" (e.g., A -> B -> C)
            if (CheckPath(this, targetFriend))
            {
                return true;
            }

            // 2. If that fails, check the other way around (e.g., C -> X -> A)
            return CheckPath(targetFriend, this);
        }

        /// <summary>
        /// Isolated, helper BFS method to find a one-way path from a start node to a target node.
        /// </summary>
        private bool CheckPath(Friend startNode, Friend targetNode)
        {
            Queue<Friend> queue = new Queue<Friend>();
            HashSet<Friend> visited = new HashSet<Friend>();

            queue.Enqueue(startNode);
            visited.Add(startNode);

            while (queue.Count > 0)
            {
                Friend current = queue.Dequeue();

                if (current.Email == targetNode.Email)
                {
                    return true; 
                }

                foreach (Friend neighbor in current.Friends)
                {
                    if (neighbor != null && !visited.Contains(neighbor))
                    {
                        visited.Add(neighbor);
                        queue.Enqueue(neighbor);
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Performs a Breadth-First Search directly inside the class to find a connected friend.
        /// </summary>
        public bool IsFriend3(Friend targetFriend)
        {
            // Guard checks for missing data
            if (targetFriend == null) return false;
            
            // If searching for yourself, return true immediately
            if (this.Email == targetFriend.Email) return true;

            // 1. Initialize the First-In, First-Out Queue with 'this' (the current person)
            Queue<Friend> queue = new Queue<Friend>();
            
            // 2. Initialize the HashSet to track memory references and prevent loop crashes
            HashSet<Friend> visited = new HashSet<Friend>();

            // Set up the starting state
            queue.Enqueue(this);
            visited.Add(this);

            // 3. Loop through layers of friends
            while (queue.Count > 0)
            {
                Friend current = queue.Dequeue();

                // 4. Check if the current person matches the target's email
                if (current.Email == targetFriend.Email)
                {
                    return true; // Stop immediately and return true
                }

                // 5. Look at all immediate connections of the current person
                foreach (Friend neighbor in current.Friends)
                {
                    // If we haven't checked this friend yet, add them to the exploration queue
                    if (neighbor != null && !visited.Contains(neighbor))
                    {
                        visited.Add(neighbor);
                        queue.Enqueue(neighbor);
                    }
                }
            }

            // Looked through the entire network and found no connection link
            return false;
        }
    
    }
    // =========================================================================
    // 2. THE GENERIC BFS ENGINE CLASS
    // =========================================================================
    
    public static class GraphExtensions
    {
        /// <summary>
        /// A reusable, memory-efficient BFS graph traversal engine.
        /// </summary>
        /// <typeparam name="T">The data type of the graph nodes.</typeparam>
        /// <param name="startNode">The object context where the search begins.</param>
        /// <param name="getNeighbors">A lambda rule defining how to locate adjacent nodes.</param>
        /// <returns>A lazily evaluated sequence of discovered nodes.</returns>
        public static IEnumerable<T> BreadthFirstSearch<T>(this T startNode, Func<T, IEnumerable<T>> getNeighbors)
        {
            // If the entry node is invalid, safely end the stream with an empty collection sequence
            if (startNode == null) 
            {
                yield break; 
            }

            // Queue manages the core First-In, First-Out (FIFO) traversal order
            var queue = new Queue<T>();
            
            // HashSet tracks visited nodes to prevent cycles and infinite loops (O(1) lookups)
            var visited = new HashSet<T>();

            // Initialize the search context
            queue.Enqueue(startNode);
            visited.Add(startNode);

            while (queue.Count > 0)
            {
                T current = queue.Dequeue();
                
                // Streams the currently evaluated node back to the caller (like .Any()) line by line
                yield return current; 

                // Dynamic retrieval of neighbor nodes using the provided lambda mapping rule
                foreach (T neighbor in getNeighbors(current))
                {
                    // .Add() automatically returns false if the item already exists in the HashSet
                    if (neighbor != null && visited.Add(neighbor))
                    {
                        queue.Enqueue(neighbor);
                    }
                }
            }
        }
    }
}
