# C# Switch Case with Enums

Using an **enum** inside a C# `switch` statement or expression provides strong typing, reduces typos, and makes code self-documenting.

---

## 1. Define the Enum
First, define your enum outside or inside your class:

```csharp
public enum OrderStatus
{
    Pending,
    Processing,
    Shipped,
    Delivered
}
```

---

## 2. Classic Switch Statement
Pass the enum variable directly into the `switch` parenthesis. Reference specific enum values using dot notation (`OrderStatus.Pending`).

```csharp
OrderStatus currentStatus = OrderStatus.Processing;

switch (currentStatus)
{
    case OrderStatus.Pending:
        Console.WriteLine("Order is awaiting review.");
        break;
        
    case OrderStatus.Processing:
        Console.WriteLine("Order is being packed.");
        break;
        
    case OrderStatus.Shipped:
    case OrderStatus.Delivered: // Grouped cases
        Console.WriteLine("Order has left the warehouse.");
        break;
        
    default:
        Console.WriteLine("Unknown status.");
        break;
}
```

---

## 3. Modern Switch Expression (C# 8.0+)
Use a switch expression for a cleaner syntax that returns a value directly:

```csharp
OrderStatus currentStatus = OrderStatus.Shipped;

string shippingMessage = currentStatus switch
{
    OrderStatus.Pending    => "Your order is safe in our system.",
    OrderStatus.Processing => "We are preparing your items.",
    OrderStatus.Shipped    => "Your package is on its way!",
    OrderStatus.Delivered  => "Package arrived safely.",
    _                      => "Invalid status." // Discard (_) handles unexpected values
};

Console.WriteLine(shippingMessage);
```

---

## 💡 IDE Time-Saving Tip
When typing a `switch` block with an enum in Visual Studio or VS Code:
1. Type `switch` and press `Tab`.
2. Type the name of your enum variable inside the parenthesis.
3. Press `Enter`. The IDE will **automatically generate** all the `case` blocks for every value defined in that enum.

---

## 🔗 Official Documentation
* https://learn.microsoft.com/en-us/dotnet/csharp/tour-of-csharp/
