<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Activity extends Model
{
    protected $table = 'activities';
    protected $keyType = 'string';
    public $incrementing = false;
    protected $fillable = ['title', 'slug', 'description', 'image', 'location', 'date', 'time', 'status', 'category'];


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
