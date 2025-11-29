import { Blocks, BookOpen, Palette, Zap } from "lucide-react";

const features = [
  {
    id: "feature-1",
    title: "Component Library",
    description:
      "Access over 50 beautifully designed components built with Tailwind CSS. Each component is fully customizable and ready for production.",
    icon: <Blocks className="size-10" strokeWidth={1.5} />,
  },
  {
    id: "feature-2",
    title: "Themeable",
    description:
      "Customize your design system with powerful theming. Create light and dark modes or match your brand colors with simple CSS variables.",
    icon: <Palette className="size-10" strokeWidth={1.5} />,
  },
  {
    id: "feature-3",
    title: "Performance",
    description:
      "Built with performance in mind. Minimal JavaScript and optimized CSS ensures your UI stays fast no matter how complex your design.",
    icon: <Zap className="size-10" strokeWidth={1.5} />,
  },
  {
    id: "feature-4",
    title: "Documentation",
    description:
      "Comprehensive documentation with examples and usage guidelines for every component. Get up and running quickly with our detailed guides.",
    icon: <BookOpen className="size-10" strokeWidth={1.5} />,
  },
];

const Feature76 = () => {
  return (
    <section className="relative pt-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="px-6 text-3xl font-semibold md:mb-4 md:text-5xl lg:mb-6 lg:max-w-md lg:px-10">
          UI Library Features
        </h2>
        <div className="relative mt-6 md:mt-10">
          <div className="bg-border absolute left-0 right-0 top-0 h-px" />
          <div className="divide-border grid md:grid-cols-4 md:divide-x">
            {features.map((feature) => (
              <div
                key={feature.id}
                className="relative px-6 pb-20 md:pb-10 lg:px-10"
              >
                <div className="bg-border absolute left-0 right-0 top-0 h-px md:hidden" />
                <div className="bg-background relative -mt-6 mb-10 flex aspect-square w-12 items-center justify-center md:-mt-10 md:mb-10 md:w-20">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="mb-3 max-w-[12rem] text-lg font-semibold md:mb-4 md:text-2xl lg:mb-6">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="bg-border absolute bottom-0 left-0 right-0 h-px" />
        </div>
      </div>
      <div className="container absolute inset-0 hidden h-full md:block">
        <div className="relative h-full">
          <div className="bg-border absolute inset-y-0 left-0 h-full w-px"></div>
          <div className="bg-border absolute inset-y-0 right-0 h-full w-px"></div>
        </div>
      </div>
    </section>
  );
};

export { Feature76 };
