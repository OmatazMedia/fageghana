<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    protected $table = 'products';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'slug', 'description', 'price', 'image', 'category', 'status', 'featured', 'tags'];


    protected static function boot()
    {
        parent::boot();
        static::creating(function ($model) {
            if (empty($model->id)) {
                $model->id = \Illuminate\Support\Str::uuid()->toString();
            }
        });
    }
}
